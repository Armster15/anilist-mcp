import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { graphql } from "./graphql";
import { execute } from "./graphql/execute";
import { MediaFormat, MediaListSort, MediaType } from "./graphql/graphql";
import { produce } from "immer";

// Create server instance
const server = new McpServer({
  name: "anilist-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

const UserQuery = graphql(`
  query UserQuery($username: String!) {
    User(name: $username) {
      name
      about
      avatar {
        large
      }
    }
  }
`);

const MediaListCollectionQuery = graphql(`
  query MediaListCollectionQuery(
    $username: String!
    $type: MediaType!
    $chunk: Int
    $perChunk: Int
    $sort: [MediaListSort]
  ) {
    MediaListCollection(
      userName: $username
      type: $type
      chunk: $chunk
      perChunk: $perChunk
      sort: $sort
    ) {
      lists {
        entries {
          score
          notes

          media {
            id
            title {
              english
              romaji
            }
            genres
            tags {
              name
            }
            recommendations {
              nodes {
                mediaRecommendation {
                  id
                  title {
                    english
                    romaji
                  }
                  genres
                  tags {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

const SearchQuery = graphql(`
  query SearchQuery(
    $page: Int = 1
    $id: Int
    $type: MediaType
    $isAdult: Boolean = false
    $search: String
    $format: [MediaFormat]
    $status: MediaStatus
    $countryOfOrigin: CountryCode
    $source: MediaSource
    $season: MediaSeason
    $seasonYear: Int
    $year: String
    $onList: Boolean
    $yearLesser: FuzzyDateInt
    $yearGreater: FuzzyDateInt
    $episodeLesser: Int
    $episodeGreater: Int
    $durationLesser: Int
    $durationGreater: Int
    $chapterLesser: Int
    $chapterGreater: Int
    $volumeLesser: Int
    $volumeGreater: Int
    $licensedBy: [Int]
    $isLicensed: Boolean
    $genres: [String]
    $excludedGenres: [String]
    $tags: [String]
    $excludedTags: [String]
    $minimumTagRank: Int
    $sort: [MediaSort] = [POPULARITY_DESC, SCORE_DESC]
    $perPage: Int = 20
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        id: $id
        type: $type
        season: $season
        format_in: $format
        status: $status
        countryOfOrigin: $countryOfOrigin
        source: $source
        search: $search
        onList: $onList
        seasonYear: $seasonYear
        startDate_like: $year
        startDate_lesser: $yearLesser
        startDate_greater: $yearGreater
        episodes_lesser: $episodeLesser
        episodes_greater: $episodeGreater
        duration_lesser: $durationLesser
        duration_greater: $durationGreater
        chapters_lesser: $chapterLesser
        chapters_greater: $chapterGreater
        volumes_lesser: $volumeLesser
        volumes_greater: $volumeGreater
        licensedById_in: $licensedBy
        isLicensed: $isLicensed
        genre_in: $genres
        genre_not_in: $excludedGenres
        tag_in: $tags
        tag_not_in: $excludedTags
        minimumTagRank: $minimumTagRank
        sort: $sort
        isAdult: $isAdult
      ) {
        id
        title {
          romaji
          english
        }
        averageScore
        popularity
        genres
      }
    }
  }
`);

server.tool(
  "get-anilist-user",
  "Gets user data for a provided username from Anilist",
  {
    username: z.string(),
  },
  async ({ username }) => {
    const res = await execute(UserQuery, { username });

    const data = res.User
      ? JSON.stringify(res.User)
      : "Failed to fetch user data.";

    return {
      content: [
        {
          type: "text",
          text: data,
        },
      ],
    };
  }
);

server.tool(
  "get-anilist-user-media",
  "Gets all the anime or manga that a specific user has watched/read. Includes user-specific data such as score, notes, and general information such as genres, description, etc.",
  {
    username: z.string(),
    type: z.union([z.literal("anime"), z.literal("manga")]),
  },

  async ({ username, type }) => {
    const res = await execute(MediaListCollectionQuery, {
      username,
      type: type === "manga" ? MediaType.Manga : MediaType.Anime,
      chunk: 0,
      perChunk: 10,
      sort: [MediaListSort.StartedOnDesc],
    });

    if (!res.MediaListCollection) {
      throw new Error("Failed to fetch data");
    }

    let actualShowsWatched: NonNullable<
      NonNullable<NonNullable<typeof res.MediaListCollection>["lists"]>[number]
    >["entries"] = [];
    for (const [_, data] of res.MediaListCollection.lists!.entries!()) {
      const entries = data!.entries!;
      for (const entry of entries) {
        actualShowsWatched.push(entry);
      }
    }

    const allShowsWatchedIds = actualShowsWatched.map(
      (entry) => entry!.media!.id
    );
    const filteredActualShowsWatched = produce(actualShowsWatched, (draft) => {
      for (const entry of draft) {
        entry!.media!.recommendations!.nodes!.filter(
          (node) =>
            !allShowsWatchedIds.includes(node?.mediaRecommendation?.id ?? 0)
        );
      }
    });

    const text = JSON.stringify(filteredActualShowsWatched);

    return {
      content: [
        {
          type: "text",
          text: text,
        },
      ],
    };
  }
);

server.tool(
  "search-anilist",
  "Searches for anime or manga on Anilist with provided criteria. Genres and tags must be valid Anilist tags; if you have access to genres and tags from previously fetched media, reference those directly as they are guaranteed to exist. As a general rule of thumb, genres are general categories (ex: Romance), while tags are more specific, so if unsure, guess genre strings but not tag strings.",
  {
    type: z.union([z.literal("anime"), z.literal("manga")]),
    query: z.string().optional(),
    genres: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  },
  async ({ query, type, genres, tags }) => {
    const res = await execute(SearchQuery, {
      format:
        type === "manga"
          ? [MediaFormat.Manga]
          : [MediaFormat.Tv, MediaFormat.Ona],
      perPage: 10,
      genres: genres,
      search: query,
      tags: tags,
    });

    const data = res.Page?.media
      ? JSON.stringify(res.Page.media)
      : "Failed to fetch user data.";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Anilist MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

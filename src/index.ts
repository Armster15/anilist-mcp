import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { graphql } from "./graphql";
import { execute } from "./graphql/execute";
import {
  MediaFormat,
  MediaListSort,
  MediaType,
  MediaStatus,
  MediaSource,
  MediaSeason,
  MediaSort,
} from "./graphql/graphql";
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
      statistics {
        anime {
          count
        }
        manga {
          count
        }
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
          }
        }
      }

      hasNextChunk
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

const MediaQuery = graphql(`
  query MediaQuery($id: Int!, $type: MediaType!) {
    Media(id: $id, type: $type) {
      id
      title {
        english
        romaji
      }
      description
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
  `
  Gets the anime or manga that a specific user has watched/read. Includes user-specific data such as score, notes, and general information such as genres, description, etc.
  You can optionally provide a chunk and perChunk parameter to get a specific chunk of the data. Use this for pagination.
  If you do not provide a chunk, it will default to 1.
  If you do not provide a perChunk, it will default to 10.
  `,
  {
    username: z.string(),
    type: z.union([z.literal("anime"), z.literal("manga")]),
    chunk: z.number().optional().default(1),
    perChunk: z.number().optional().default(10),
  },

  async ({ username, type, chunk, perChunk }) => {
    const res = await execute(MediaListCollectionQuery, {
      username,
      type: type === "manga" ? MediaType.Manga : MediaType.Anime,
      chunk,
      perChunk,
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

    let hasNextChunk = res.MediaListCollection.hasNextChunk;

    // const allShowsWatchedIds = actualShowsWatched.map(
    //   (entry) => entry!.media!.id
    // );
    // const filteredActualShowsWatched = produce(actualShowsWatched, (draft) => {
    //   for (const entry of draft) {
    //     entry!.media!.recommendations!.nodes!.filter(
    //       (node) =>
    //         !allShowsWatchedIds.includes(node?.mediaRecommendation?.id ?? 0)
    //     );
    //   }
    // });

    const text = JSON.stringify({
      showsWatched: actualShowsWatched,
      hasNextChunk,
    });

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
    page: z.number().optional(),
    id: z.number().optional(),
    isAdult: z.boolean().optional(),
    search: z.string().optional(),
    format: z.array(z.nativeEnum(MediaFormat)).optional(),
    status: z.nativeEnum(MediaStatus).optional(),
    countryOfOrigin: z.string().optional(),
    source: z.nativeEnum(MediaSource).optional(),
    season: z.nativeEnum(MediaSeason).optional(),
    seasonYear: z.number().optional(),
    year: z.string().optional(),
    onList: z.boolean().optional(),
    yearLesser: z.number().optional(),
    yearGreater: z.number().optional(),
    episodeLesser: z.number().optional(),
    episodeGreater: z.number().optional(),
    durationLesser: z.number().optional(),
    durationGreater: z.number().optional(),
    chapterLesser: z.number().optional(),
    chapterGreater: z.number().optional(),
    volumeLesser: z.number().optional(),
    volumeGreater: z.number().optional(),
    licensedBy: z.array(z.number()).optional(),
    isLicensed: z.boolean().optional(),
    genres: z.array(z.string()).optional(),
    excludedGenres: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    excludedTags: z.array(z.string()).optional(),
    minimumTagRank: z.number().optional(),
    sort: z.array(z.nativeEnum(MediaSort)).optional(),
    perPage: z.number().optional(),
  },
  async (args) => {
    const { type, ...rest } = args;
    // Default format for anime/manga if not provided
    let format = rest.format;
    if (!format) {
      format =
        type === "manga"
          ? [MediaFormat.Manga]
          : [MediaFormat.Tv, MediaFormat.Ona];
    }
    // For GraphQL, if format or sort is a single value, pass as value, else as array
    let gqlFormat: any = format;
    if (Array.isArray(format)) {
      if (format.length === 1) {
        gqlFormat = format[0];
      } else if (format.length === 0) {
        gqlFormat = undefined;
      }
    }
    let sort = rest.sort;
    let gqlSort: any = sort;
    if (Array.isArray(sort)) {
      if (sort.length === 1) {
        gqlSort = sort[0];
      } else if (sort.length === 0) {
        gqlSort = undefined;
      }
    }
    const res = await execute(SearchQuery, {
      ...rest,
      type: type === "manga" ? MediaType.Manga : MediaType.Anime,
      ...(gqlFormat ? { format: gqlFormat } : {}),
      ...(gqlSort ? { sort: gqlSort } : {}),
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

server.tool(
  "get-anilist-media",
  "Gets information about a specific media item on Anilist from its id",
  {
    id: z.number(),
    type: z.union([z.literal("anime"), z.literal("manga")]),
  },
  async ({ id, type }) => {
    const res = await execute(MediaQuery, {
      id,
      type: type === "manga" ? MediaType.Manga : MediaType.Anime,
    });

    const data = res.Media
      ? JSON.stringify(res.Media)
      : "Failed to fetch media data.";

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Anilist MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

# anilist-mcp

An extremely hacky MCP server for Anilist.

I built a rough prototype of this in 1-2 hours (see the initial commit) and am now steadily iterating on it. This is my first ever MCP server, so just playing around :)

## Setup

I'm assuming you know the basics around MCP, including already having Claude Desktop installed. If not, follow this guide: https://modelcontextprotocol.io/quickstart/user

1. In this repo: `npm install && npm run build`

   A built file will appear in `build/index.js`. This is the MCP server.

2. Add this to your Claude MCP config:

   ```json
   {
     "mcpServers": {
       "anilist-mcp": {
         "command": "node",
         "args": ["<ABSOLUTE_PATH>/anilist-mcp/build/index.js"]
       }
     }
   }
   ```

## Usage

This is the current prompt I'm using:

```
Get details on <username> from Anilist and get all the anime they have watched. It is imperative you get all the shows watched. Then, recommend some anime the user will enjoy.

While finding anime to recommend, keep these in mind:
- Only recommend shows a user has never watched
- You can look up a specific media item to retrieve recommendations similar to it
- You can use the search tool for broader queries. However, ensure you rely on score and not popularity
- As tastes evolve overtime, try to recommend shows from genres and tags that are more inline with what a user has enjoyed more recently
- For diversity, if possible try finding shows from a diverse range of years. It is acceptable go back by at most the year 2000.

When outputting your recommendations, categorize them by genres. Genres should be those a user has been identified to enjoy.

Format an individual show recommendation as follows:
- Title
- Genre(s)
- Tag(s)
- A brief explanation of why you recommended this show
- A URL to the given media in the following format: https://anilist.co/anime/:id

Do not rely on your preconceived notions of anime. Always refer to Anilist as an authoritative source of data.
```

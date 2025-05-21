# anilist-mcp

An extremely hacky MCP server for Anilist I built in 1-2 hours.

This is my first ever MCP server, so just playing around :)

## Current Shortcomings

As mentioned, this is super rough.

The biggest shortcoming is that there's a lot of data for the LLM to process, as each show watched has a lot of data. This means a lot of tokens, and sometimes Claude won't allow you to provide a large number of tokens. Plus you don't want your usage to go really high.

Currently, when you get all the anime a user has watched, it returns only the 10 latest shows watched. Similarily, searching for anime yields 10 results. You can edit this as it's all in code.

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
Get details on "<username>" from Anilist and get the anime they have watched. Based on these, recommend some anime the user has not already watched using Anilist's search tool.
```

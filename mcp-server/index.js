import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "..", "interview.db");

// --- Database helpers ---

function openDb() {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function withDb(fn) {
  const db = openDb();
  if (!db) return fn(null);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** Safely parse a JSON string, returning the original string on failure. */
function tryParseJson(value) {
  if (value == null) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Profile fields that are stored as JSON strings in SQLite. */
const JSON_PROFILE_FIELDS = [
  "did_you_know",
  "ask_me_about",
  "experience",
  "life_at_glance",
  "dreams",
  "inspirations",
];

/** Parse JSON fields in a profile row. */
function parseProfileRow(row) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_PROFILE_FIELDS) {
    if (parsed[field] != null) {
      parsed[field] = tryParseJson(parsed[field]);
    }
  }
  parsed.published = Boolean(parsed.published);
  return parsed;
}

// --- MCP Server ---

const server = new McpServer({
  name: "interview-admin",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "list_interviews",
  "List all interviews with status, participant name, created date. Optional filter by status.",
  {
    status: z
      .enum(["in_progress", "content_ready", "approved", "published"])
      .optional()
      .describe("Filter by interview status"),
  },
  ({ status }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ interviews: [], note: "Database not found" }) }] };
      }
      let sql = "SELECT id, participant_name, status, language, created_at, updated_at FROM interviews";
      const params = [];
      if (status) {
        sql += " WHERE status = ?";
        params.push(status);
      }
      sql += " ORDER BY created_at DESC";
      const rows = db.prepare(sql).all(...params);
      return { content: [{ type: "text", text: JSON.stringify({ interviews: rows, count: rows.length }) }] };
    });
  }
);

server.tool(
  "get_interview",
  "Get full interview details including all answers, chat messages, and profile if generated.",
  {
    interview_id: z.string().describe("The interview ID"),
  },
  ({ interview_id }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not found" }) }] };
      }
      const interview = db
        .prepare("SELECT * FROM interviews WHERE id = ?")
        .get(interview_id);
      if (!interview) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Interview not found" }) }] };
      }
      const answers = db
        .prepare("SELECT * FROM answers WHERE interview_id = ? ORDER BY created_at ASC")
        .all(interview_id);
      const chatMessages = db
        .prepare("SELECT * FROM chat_messages WHERE interview_id = ? ORDER BY created_at ASC")
        .all(interview_id);
      const profile = db
        .prepare("SELECT * FROM profiles WHERE interview_id = ?")
        .get(interview_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              interview,
              answers,
              chat_messages: chatMessages,
              profile: profile ? parseProfileRow(profile) : null,
            }),
          },
        ],
      };
    });
  }
);

server.tool(
  "list_profiles",
  "List all generated profiles with name, status, publish state. Optional filter by published.",
  {
    published: z.boolean().optional().describe("Filter by published state"),
  },
  ({ published }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ profiles: [], note: "Database not found" }) }] };
      }
      let sql =
        "SELECT p.id, p.interview_id, p.name, p.photo_url, p.published, p.created_at, p.updated_at, i.status as interview_status FROM profiles p LEFT JOIN interviews i ON p.interview_id = i.id";
      const params = [];
      if (published !== undefined) {
        sql += " WHERE p.published = ?";
        params.push(published ? 1 : 0);
      }
      sql += " ORDER BY p.created_at DESC";
      const rows = db.prepare(sql).all(...params);
      const profiles = rows.map((r) => ({ ...r, published: Boolean(r.published) }));
      return { content: [{ type: "text", text: JSON.stringify({ profiles, count: profiles.length }) }] };
    });
  }
);

server.tool(
  "get_profile",
  "Get complete profile content.",
  {
    profile_id: z.number().int().describe("The profile ID"),
  },
  ({ profile_id }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not found" }) }] };
      }
      const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(profile_id);
      if (!row) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Profile not found" }) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(parseProfileRow(row)) }] };
    });
  }
);

server.tool(
  "update_profile",
  "Update any profile field.",
  {
    profile_id: z.number().int().describe("The profile ID"),
    fields: z
      .object({
        name: z.string().optional(),
        intro: z.string().optional(),
        motto: z.string().optional(),
        did_you_know: z.string().optional(),
        ask_me_about: z.string().optional(),
        superpower_title: z.string().optional(),
        superpower_description: z.string().optional(),
        experience: z.string().optional(),
        life_at_glance: z.string().optional(),
        dreams: z.string().optional(),
        inspirations: z.string().optional(),
        photo_url: z.string().optional(),
      })
      .describe("Fields to update"),
  },
  ({ profile_id, fields }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not found" }) }] };
      }
      const existing = db.prepare("SELECT id FROM profiles WHERE id = ?").get(profile_id);
      if (!existing) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Profile not found" }) }] };
      }

      const allowedFields = [
        "name", "intro", "motto", "did_you_know", "ask_me_about",
        "superpower_title", "superpower_description", "experience",
        "life_at_glance", "dreams", "inspirations", "photo_url",
      ];

      const setClauses = [];
      const values = [];
      for (const [key, value] of Object.entries(fields)) {
        if (allowedFields.includes(key) && value !== undefined) {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (setClauses.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No valid fields to update" }) }] };
      }

      setClauses.push("updated_at = datetime('now')");
      values.push(profile_id);

      db.prepare(`UPDATE profiles SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

      const updated = db.prepare("SELECT * FROM profiles WHERE id = ?").get(profile_id);
      return { content: [{ type: "text", text: JSON.stringify({ success: true, profile: parseProfileRow(updated) }) }] };
    });
  }
);

server.tool(
  "publish_profile",
  "Toggle a profile's published status.",
  {
    profile_id: z.number().int().describe("The profile ID"),
    published: z.boolean().describe("Whether the profile should be published"),
  },
  ({ profile_id, published }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not found" }) }] };
      }
      const existing = db.prepare("SELECT id FROM profiles WHERE id = ?").get(profile_id);
      if (!existing) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Profile not found" }) }] };
      }

      db.prepare("UPDATE profiles SET published = ?, updated_at = datetime('now') WHERE id = ?").run(
        published ? 1 : 0,
        profile_id
      );

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, profile_id, published }) },
        ],
      };
    });
  }
);

server.tool(
  "delete_profile",
  "Delete a profile and optionally its interview.",
  {
    profile_id: z.number().int().describe("The profile ID"),
    delete_interview: z.boolean().default(false).describe("Also delete the associated interview and all its data"),
  },
  ({ profile_id, delete_interview }) => {
    return withDb((db) => {
      if (!db) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Database not found" }) }] };
      }
      const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(profile_id);
      if (!profile) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Profile not found" }) }] };
      }

      const interviewId = profile.interview_id;

      db.prepare("DELETE FROM profiles WHERE id = ?").run(profile_id);

      if (delete_interview && interviewId) {
        db.prepare("DELETE FROM chat_messages WHERE interview_id = ?").run(interviewId);
        db.prepare("DELETE FROM answers WHERE interview_id = ?").run(interviewId);
        db.prepare("DELETE FROM interviews WHERE id = ?").run(interviewId);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              deleted_profile: profile_id,
              deleted_interview: delete_interview ? interviewId : null,
            }),
          },
        ],
      };
    });
  }
);

server.tool(
  "get_stats",
  "Get overview stats: total interviews, in progress, completed, published profiles.",
  {},
  () => {
    return withDb((db) => {
      if (!db) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                total_interviews: 0,
                in_progress: 0,
                content_ready: 0,
                approved: 0,
                published_profiles: 0,
                total_profiles: 0,
                note: "Database not found",
              }),
            },
          ],
        };
      }

      const totalInterviews = db.prepare("SELECT COUNT(*) as count FROM interviews").get().count;
      const inProgress = db.prepare("SELECT COUNT(*) as count FROM interviews WHERE status = 'in_progress'").get().count;
      const contentReady = db.prepare("SELECT COUNT(*) as count FROM interviews WHERE status = 'content_ready'").get().count;
      const approved = db.prepare("SELECT COUNT(*) as count FROM interviews WHERE status = 'approved'").get().count;
      const totalProfiles = db.prepare("SELECT COUNT(*) as count FROM profiles").get().count;
      const publishedProfiles = db.prepare("SELECT COUNT(*) as count FROM profiles WHERE published = 1").get().count;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_interviews: totalInterviews,
              in_progress: inProgress,
              content_ready: contentReady,
              approved: approved,
              total_profiles: totalProfiles,
              published_profiles: publishedProfiles,
            }),
          },
        ],
      };
    });
  }
);

// --- Resources ---

server.resource(
  "profiles",
  "interview://profiles",
  { description: "List of all profiles" },
  () => {
    return withDb((db) => {
      if (!db) {
        return { contents: [{ uri: "interview://profiles", text: JSON.stringify({ profiles: [] }) }] };
      }
      const rows = db
        .prepare(
          "SELECT p.id, p.name, p.published, p.interview_id, p.created_at, i.status as interview_status FROM profiles p LEFT JOIN interviews i ON p.interview_id = i.id ORDER BY p.created_at DESC"
        )
        .all();
      const profiles = rows.map((r) => ({ ...r, published: Boolean(r.published) }));
      return { contents: [{ uri: "interview://profiles", text: JSON.stringify({ profiles }) }] };
    });
  }
);

server.resource(
  "stats",
  "interview://stats",
  { description: "Current interview statistics" },
  () => {
    return withDb((db) => {
      if (!db) {
        return {
          contents: [
            {
              uri: "interview://stats",
              text: JSON.stringify({
                total_interviews: 0,
                total_profiles: 0,
                published_profiles: 0,
              }),
            },
          ],
        };
      }
      const totalInterviews = db.prepare("SELECT COUNT(*) as count FROM interviews").get().count;
      const totalProfiles = db.prepare("SELECT COUNT(*) as count FROM profiles").get().count;
      const publishedProfiles = db.prepare("SELECT COUNT(*) as count FROM profiles WHERE published = 1").get().count;
      return {
        contents: [
          {
            uri: "interview://stats",
            text: JSON.stringify({
              total_interviews: totalInterviews,
              total_profiles: totalProfiles,
              published_profiles: publishedProfiles,
            }),
          },
        ],
      };
    });
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});

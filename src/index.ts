import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with Gmail tools
export class GmailMCP extends McpAgent {
    server = new McpServer({
        name: "Gmail MCP",
        version: "0.1.0",
    });
    
    token: string | null = null;
    baseUrl = "https://googleauth.ishikabhoyar2005.workers.dev/";

    async init() {
        // Authentication tool
        this.server.tool(
            "authenticate",
            "Authenticate with Google to access Gmail, Calendar, and Classroom services",
            {
                token: z.string().optional().describe("The authentication token received from the auth process"),
            },
            async ({ token }) => {
                if (!token) {
                    const authUrl = `${this.baseUrl}/google/auth/gmail?redirect_url=${this.baseUrl}/token-helper`;
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Please visit this URL to authorize the application:\n${authUrl}\n\nAfter authorization, you'll receive a token. Please provide that token to complete authentication.`,
                            },
                        ],
                    };
                }

                this.token = token;
                return {
                    content: [
                        {
                            type: "text",
                            text: "Authentication successful! You can now use Gmail tools.",
                        },
                    ],
                };
            }
        );

        // Search emails tool
        this.server.tool(
            "search_emails",
            "Search for emails in Gmail using Gmail search syntax",
            {
                query: z.string().describe("Gmail search query (e.g., \"from:example@gmail.com\", \"subject:important\", \"is:unread\")"),
            },
            async ({ query }) => {
                try {
                    const result = await this.makeRequest(`/gmail/search?q=${encodeURIComponent(query)}`);
                    
                    if (!result?.messages?.length) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No messages found matching the search query.",
                                },
                            ],
                        };
                    }

                    const messageList = result.messages.map((msg: any) => 
                        `ID: ${msg.id}\n` +
                        `Thread ID: ${msg.threadId}\n` +
                        (msg.snippet ? `Snippet: ${msg.snippet}\n` : '') +
                        '---'
                    ).join('\n');

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Found ${result.messages.length} messages:\n\n${messageList}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Get email tool
        this.server.tool(
            "get_email",
            "Retrieve a specific email by its message ID",
            {
                messageId: z.string().describe("The Gmail message ID"),
            },
            async ({ messageId }) => {
                try {
                    const message = await this.makeRequest(`/gmail/message?messageId=${messageId}&decode=true`);
                    
                    let content = `Message ID: ${message.id}\n`;
                    if (message.threadId) content += `Thread ID: ${message.threadId}\n`;
                    if (message.snippet) content += `Snippet: ${message.snippet}\n\n`;

                    if (message.payload?.headers) {
                        content += 'Headers:\n';
                        message.payload.headers.forEach((header: any) => {
                            content += `${header.name}: ${header.value}\n`;
                        });
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: content,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // List labels tool
        this.server.tool(
            "list_labels",
            "List all Gmail labels in the user's account",
            {},
            async () => {
                try {
                    const result = await this.makeRequest('/gmail/labels');
                    
                    if (!result?.labels?.length) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No labels found.",
                                },
                            ],
                        };
                    }

                    const labelText = result.labels
                        .map((label: any) => `${label.name} (${label.id}) - ${label.type}`)
                        .join('\n');

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Gmail Labels:\n\n${labelText}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Get profile tool
        this.server.tool(
            "get_profile",
            "Get information about the user's Gmail profile",
            {},
            async () => {
                try {
                    const profile = await this.makeRequest('/gmail/list');
                    
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Gmail Profile:\n${JSON.stringify(profile, null, 2)}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Calendar events tools
        this.server.tool(
            "list_events",
            "List calendar events within a specified time range",
            {
                timeMin: z.string().optional().describe("Start time for listing events (RFC3339 timestamp)"),
                timeMax: z.string().optional().describe("End time for listing events (RFC3339 timestamp)"),
                maxResults: z.number().optional().describe("Maximum number of events to return"),
            },
            async ({ timeMin, timeMax, maxResults }) => {
                try {
                    const queryParams = new URLSearchParams();
                    if (timeMin) queryParams.append('timeMin', timeMin);
                    if (timeMax) queryParams.append('timeMax', timeMax);
                    if (maxResults) queryParams.append('maxResults', maxResults.toString());
                    
                    const events = await this.makeRequest(`/calendar/events?${queryParams.toString()}`);
                    
                    if (!events?.items?.length) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No events found.",
                                },
                            ],
                        };
                    }

                    const eventList = events.items.map((event: any) => {
                        let details = `Title: ${event.summary}\n`;
                        if (event.description) details += `Description: ${event.description}\n`;
                        details += `Start: ${event.start.dateTime || event.start.date}\n`;
                        details += `End: ${event.end.dateTime || event.end.date}\n`;
                        if (event.attendees?.length) {
                            details += 'Attendees:\n';
                            event.attendees.forEach((attendee: any) => {
                                details += `  - ${attendee.email}\n`;
                            });
                        }
                        details += '---\n';
                        return details;
                    }).join('\n');

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Found ${events.items.length} events:\n\n${eventList}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Create calendar event
        this.server.tool(
            "create_event",
            "Create a new event in Google Calendar",
            {
                summary: z.string().describe("Title of the event"),
                description: z.string().optional().describe("Description of the event"),
                start: z.object({
                    dateTime: z.string().describe("Start time (RFC3339 timestamp)"),
                    timeZone: z.string().optional().describe("Timezone for the start time"),
                }),
                end: z.object({
                    dateTime: z.string().describe("End time (RFC3339 timestamp)"),
                    timeZone: z.string().optional().describe("Timezone for the end time"),
                }),
                attendees: z
                    .array(
                        z.object({
                            email: z.string().describe("Email address of the attendee"),
                        })
                    )
                    .optional()
                    .describe("List of attendees"),
            },
            async (args) => {
                try {
                    const response = await this.makeRequest('/calendar/events', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(args),
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Event created successfully!\nID: ${response.id}\nTitle: ${response.summary}\nStart: ${response.start.dateTime}\nEnd: ${response.end.dateTime}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Classroom tools
        this.server.tool(
            "list_courses",
            "List all Google Classroom courses available to the user",
            {},
            async () => {
                try {
                    const courses = await this.makeRequest('/classroom/courses');
                    
                    if (!courses?.courses?.length) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No courses found.",
                                },
                            ],
                        };
                    }

                    const courseList = courses.courses.map((course: any) => {
                        let details = `Name: ${course.name}\n`;
                        details += `ID: ${course.id}\n`;
                        if (course.section) details += `Section: ${course.section}\n`;
                        if (course.description) details += `Description: ${course.description}\n`;
                        details += `---\n`;
                        return details;
                    }).join('\n');

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Found ${courses.courses.length} courses:\n\n${courseList}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: ${(error as Error).message}`,
                            },
                        ],
                    };
                }
            }
        );

        // Add more tools based on the provided Node.js implementation
        // List coursework, list announcements, get coursework, get assignment materials, etc.
    }

    // Helper method to make authenticated requests
    async makeRequest(endpoint: string, options: RequestInit = {}) {
        if (!this.token) {
            throw new Error('Authentication required. Please use the authenticate tool first with no parameters to get the authorization URL. After visiting that URL and completing authentication, call authenticate again with the token you receive.');
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API request failed (${response.status}): ${response.statusText}. ${errorData}`);
        }

        return response.json();
    }
}

// Export GmailMCP as a Durable Object
export { GmailMCP as MyMCP };

// Interface for Cloudflare Worker environment
interface Env {
    // Add any Worker environment bindings here
    MyMCP: DurableObjectNamespace;
}

export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        if (url.pathname === "/sse" || url.pathname === "/sse/message") {
            return GmailMCP.serveSSE("/sse").fetch(request, env, ctx);
        }

        if (url.pathname === "/mcp" || url.pathname === "/") {
            return GmailMCP.serve("/mcp").fetch(request, env, ctx);
        }

        return new Response("Not found", { status: 404 });
    },
};
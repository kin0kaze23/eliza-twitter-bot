
import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token from the environment variables
const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

export interface ApifyTweet {
    id: string;
    text: string;
    user?: {
        id_str: string;
        screen_name: string;
        name: string;
        profile_image_url_https?: string;
    };
    created_at: string;
    favorite_count: number;
    retweet_count: number;
    reply_count: number;
    conversation_id: string;
    in_reply_to_status_id_str?: string;
    entities?: {
        urls?: Array<{ expanded_url: string }>;
        media?: Array<{ media_url_https: string, type: string }>;
    };
}

/**
 * Service to handle Apify interactions for Twitter scraping
 * Uses 'apidojo/tweet-scraper' or compatible Actor
 */
export const ApifyService = {
    /**
     * Search for tweets using Apify
     * @param query Search query
     * @param limit Max number of tweets
     */
    async searchTweets(query: string, limit: number = 20): Promise<ApifyTweet[]> {
        if (!process.env.APIFY_API_TOKEN) {
            console.warn('[ApifyService] No API token found, skipping Apify search');
            return [];
        }

        try {
            console.log(`[ApifyService] Searching tweets for query: "${query}" (limit: ${limit})`);

            // Using 'apidojo/tweet-scraper' (reliable, widely used)
            // Input parameters may vary by actor, this conforms to common Tweet Scraper inputs
            const run = await client.actor("61RPP7dywgiy0JPD0").call({
                searchTerms: [query],
                maxItems: limit,
                sort: "Latest",
                tweetLanguage: "en"
            });

            console.log(`[ApifyService] Actor run started: ${run.id}, waiting for results...`);

            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            // Map the raw results to our interface
            // Note: Different actors return slightly different structures, adapting for apidojo/tweet-scraper
            const tweets: ApifyTweet[] = items.map((item: any) => ({
                id: item.id_str || item.id,
                text: item.full_text || item.text,
                user: {
                    id_str: item.user?.id_str || item.user_id_str,
                    screen_name: item.user?.screen_name || item.screen_name,
                    name: item.user?.name || item.name,
                    profile_image_url_https: item.user?.profile_image_url_https || item.user_profile_image_url,
                },
                created_at: item.created_at,
                favorite_count: item.favorite_count || 0,
                retweet_count: item.retweet_count || 0,
                reply_count: item.reply_count || 0,
                conversation_id: item.conversation_id_str || item.conversation_id,
                in_reply_to_status_id_str: item.in_reply_to_status_id_str,
                entities: {
                    urls: item.entities?.urls || [],
                    media: item.extended_entities?.media || item.entities?.media || [],
                }
            }));

            console.log(`[ApifyService] Found ${tweets.length} tweets for query "${query}"`);
            return tweets;

        } catch (error) {
            console.error('[ApifyService] Error searching tweets:', error);
            return [];
        }
    },

    /**
     * Get user profile and recent tweets
     * @param username Twitter handle (without @)
     * @param limit Max tweets
     */
    async getUserTweets(username: string, limit: number = 20): Promise<ApifyTweet[]> {
        // We can re-use search with "from:username" which is often cheaper/faster
        // regarding rate limits on some actors than dedicated profile scraping
        return this.searchTweets(`from:${username}`, limit);
    }
};

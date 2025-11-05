// fediverse.js - Minimal fediverse client
const fediverse = {
    async load_posts_from_api(instanceURL, accessToken, options = {}) {
        const { limit = 10, max_id } = options

        const params = new URLSearchParams({
            limit: limit.toString()
        })

        if (max_id) {
            params.append('max_id', max_id)
        }

        const response = await fetch(`https://${instanceURL}/api/v1/timelines/home?${params}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch timeline: ${response.status} ${response.statusText}`)
        }

        const statuses = await response.json()

        return statuses.map(status => {
            const post = {
                id: status.id,
                author: status.account.display_name || status.account.username,
                username: `@${status.account.username}@${instanceURL}`,
                avatar: status.account.avatar,
                content: status.content,
                media_attachments: status.media_attachments || [],
                starred: status.favourited || false,
                boosted: status.reblogged || false,
                favourites_count: status.favourites_count || 0,
                reblogs_count: status.reblogs_count || 0,
                created_at: new Date(status.created_at).toLocaleString(),
                raw: status
            };

            // Check if this is a toot package
            const packageMatch = status.content.match(/#TootPkg:([^\s<]+)/);
            if (packageMatch) {
                post.isPackage = true;
                post.packageId = packageMatch[1];
                post.packageInfo = fediverse.parsePackageHeader(status.content);
            }

            return post;
        })
    },

    async load_posts(flavor = 'mastodon', options = {}) {
        await new Promise(resolve => setTimeout(resolve, 500))

        const { limit = 10, offset = 0 } = options

        const posts = []
        const baseId = offset + 1

        for (let i = 0; i < limit; i++) {
            const id = baseId + i

            if (flavor === 'mastodon') {
                const hasImage = id % 3 === 0 // Every 3rd post has an image
                const isPackage = id % 5 === 0 // Every 5th post is a package

                if (isPackage) {
                    posts.push({
                        id: `mastodon_${id}`,
                        author: `User ${id}`,
                        username: `@user${id}@mastodon.social`,
                        avatar: `https://picsum.photos/seed/user${id}/64/64`,
                        content: `📦 Package: "Morning Thoughts ${id}" (3 toots)\n#TootPkg:morning-${id}\nA collection of my morning musings today`,
                        media_attachments: [],
                        starred: Math.random() > 0.7,
                        boosted: Math.random() > 0.8,
                        favourites_count: Math.floor(Math.random() * 20),
                        reblogs_count: Math.floor(Math.random() * 10),
                        created_at: new Date(Date.now() - id * 3600000).toISOString(),
                        flavor: 'mastodon',
                        isPackage: true,
                        packageId: `morning-${id}`,
                        packageInfo: {
                            title: `Morning Thoughts ${id}`,
                            count: 3
                        }
                    })
                } else {
                    posts.push({
                        id: `mastodon_${id}`,
                        author: `User ${id}`,
                        username: `@user${id}@mastodon.social`,
                        avatar: `https://picsum.photos/seed/user${id}/64/64`,
                        content: `This is a Mastodon post #${id}. 🐘 Tooting some thoughts!${hasImage ? ' Check out this image!' : ''}`,
                        media_attachments: hasImage ? [{
                            id: `media_${id}`,
                            type: 'image',
                            url: `https://picsum.photos/seed/post${id}/600/400`,
                            preview_url: `https://picsum.photos/seed/post${id}/300/200`,
                            description: `Sample image for post ${id}`
                        }] : [],
                        starred: Math.random() > 0.7,
                        boosted: Math.random() > 0.8,
                        favourites_count: Math.floor(Math.random() * 20),
                        reblogs_count: Math.floor(Math.random() * 10),
                        created_at: new Date(Date.now() - id * 3600000).toISOString(),
                        flavor: 'mastodon'
                    })
                }
            } else if (flavor === 'akkoma') {
                const hasImage = id % 4 === 0 // Every 4th post has an image
                posts.push({
                    id: `akkoma_${id}`,
                    author: `Akkoma User ${id}`,
                    username: `@akkoma_user${id}@akkoma.dev`,
                    avatar: `https://picsum.photos/seed/akkoma${id}/64/64`,
                    content: `Akkoma post ${id} - Lightweight and feature-rich! ✨${hasImage ? ' With a nice photo!' : ''}`,
                    media_attachments: hasImage ? [{
                        id: `media_akkoma_${id}`,
                        type: 'image',
                        url: `https://picsum.photos/seed/akkoma${id}/600/400`,
                        preview_url: `https://picsum.photos/seed/akkoma${id}/300/200`,
                        description: `Akkoma sample image ${id}`
                    }] : [],
                    created_at: new Date(Date.now() - id * 3600000).toISOString(),
                    flavor: 'akkoma'
                })
            } else {
                posts.push({
                    id: `ap_${id}`,
                    author: `Generic User ${id}`,
                    username: `@generic${id}@fediverse.example`,
                    avatar: `https://picsum.photos/seed/generic${id}/64/64`,
                    content: `Generic ActivityPub post ${id}`,
                    media_attachments: [],
                    created_at: new Date(Date.now() - id * 3600000).toISOString(),
                    flavor: 'generic'
                })
            }
        }

        return posts
    },

    parsePackageHeader(content) {
        // Parse package title from content like: 📦 Package: "Title" (3 toots)
        const titleMatch = content.match(/📦\s*(?:Package:\s*)?["""]([^"""]+)["""]?\s*\((\d+)\s*toots?\)/i);
        if (titleMatch) {
            return {
                title: titleMatch[1],
                count: parseInt(titleMatch[2])
            };
        }

        // Fallback parsing
        const countMatch = content.match(/\((\d+)\s*toots?\)/i);
        return {
            title: 'Toot Package',
            count: countMatch ? parseInt(countMatch[1]) : 1
        };
    }
}

// Make it available globally
window.fediverse = fediverse

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

        return statuses.map(status => ({
            id: status.id,
            author: status.account.display_name || status.account.username,
            username: `@${status.account.username}@${instanceURL}`,
            avatar: status.account.avatar,
            content: status.content,
            media_attachments: status.media_attachments || [],
            created_at: new Date(status.created_at).toLocaleString(),
            raw: status
        }))
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
                    created_at: new Date(Date.now() - id * 3600000).toISOString(),
                    flavor: 'mastodon'
                })
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
    }
}

// Make it available globally
window.fediverse = fediverse

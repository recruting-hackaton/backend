import { Hono } from 'hono'
import { prisma } from '..'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'


export const post = new OpenAPIHono()

post.get('/comments', async (c) => {
  const retPostWithComms = await prisma.post.findMany({
    include: {
      comments: true,
    },
  })
  return c.json(retPostWithComms)
})

post.get('/search', async (c) => {
  const searchQuery = c.req.query('searchQuery')

  if (!searchQuery) {
    return c.json(400)
  }

  try {
    const post = await prisma.post.findMany({
      where: {
        title: {
          search: searchQuery,
        },
        content: {
          search: searchQuery,
        },
      },
      include: {
        tags: true,
      },
    })

    return c.json(post)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

//return post
post.get('/:id', async (c) => {
  const postId = c.req.param('id')
  const getPost = await prisma.post.findUnique({
    where: {
      id: Number(postId),
    },
    include: {
      comments: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return c.json(getPost)
})

//add post
post.post('/', async (c) => {
  const { userId, title, content, tags } = await c.req.json()
  const post = await prisma.post.create({
    data: {
      title,
      content,
      tags: {
        connectOrCreate: tags.map((tag: any) => ({
          where: { name: tag },
          create: { name: tag },
        })),
      },
      user: {
        connect: {
          id: userId,
        },
      },
    },
  })

  return c.json(post)
})

//delete post
post.delete(`/:id`, async (c) => {
  const postId = c.req.param('id')
  const post = await prisma.post.delete({
    where: {
      id: Number(postId),
    },
  })
  return c.json(post)
})

//change post
post.put('/:id', async (c) => {
  const updatedPostId = c.req.param('id')
  const { title, content } = await c.req.json()
  try {
    const updatedPost = await prisma.post.update({
      where: { id: Number(updatedPostId) },
      data: {
        title: title,
        content: content,
      },
    })
    return c.json(updatedPost)
  } catch (error) {
    return c.json(404)
  }
})
//return all posts
post.get('/', async (c) => {
  const getAllPosts = await prisma.post.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      tags: true,
    },
  })

  return c.json(getAllPosts)
})

//posts by tags
post.get('/posts', async (c) => {
  const tagQuery = c.req.query('tag')
  if (!tagQuery) {
    return c.json({ error: 'Invalid tag parameter' }, 400)
  }

  try {
    const posts = await prisma.post.findMany({
      where: {
        tags: {
          some: {
            name: {
              in: tagQuery.split(','),
            },
          },
        },
      },
      include: {
        tags: true,
      },
    })

    return c.json(posts)
  } catch (error) {
    return c.json(400)
  }
})


const addPostRoute = createRoute({
  method: 'post',
  path: '//',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.any(),
            userId: z.number(),
            title: z.any(),
            tags: z.string()
          }),
        },
      },
      description:"В блоке data указываются заголовок и содержание поста, а также связь с тегами и пользователем. Используется метод connectOrCreate для тегов.Метод connect устанавливает связь с существующим пользователем через его идентификатор.После успешного создания поста объект post, который был создан, отправляется в ответ на запрос в формате JSON."
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.any(),
            userId: z.number(),
            title: z.any(),
            tags: z.string()
          }),
        },
      },
      description: 'search candidates response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(addPostRoute, (c) => {
  return c.json(
    {
    content: 'explain feratures',
    userId: 1,
    title: 'devops',
    tags: "dev"
    },
    200
  )
})

const postByIdRoute = createRoute({
  method: 'get',
  path: '/:id/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.any(),
            userId: z.number(),
            postId: z.number(),
            firstName: z.string(),
            lastName: z.string(),
            id: z.number(),
            createdAt: z.string(),
            avatar: z.any()
          }),
        },
      },
      description: 'search candidates response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(postByIdRoute, (c) => {
  return c.json(
    {
    content: 'explain feratures',
    userId: 1,
    postId: 2,
    firstName: 'Platon',
    lastName: 'lukichev',
    id: 1,
    createdAt: new Date(),
    avatar: ''
    },
    200
  )
})

const deletePostRoute = createRoute({
  method: 'delete',
  path: '/:id/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            postId: z.number(),
            
          }),
        },
      },
      description: 'delete post response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(deletePostRoute, (c) => {
  return c.json(
    {
    postId: 2,
    },
    200
  )
})

const changePostRoute = createRoute({
  method: 'put',
  path: '/:id/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.any(),
            content: z.any()
            
          }),
        },
      },
      description: 'change post response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(changePostRoute, (c) => {
  return c.json(
    {
    title: 'devops backend',
    content: 'backend on hono.js'
    },
    200
  )
})

const returnAllPostsRoute = createRoute({
  method: 'get',
  path: '/:id/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.any(),
            userId: z.number(),
            title: z.any(),
            tags: z.object({}).array(),
            id: z.number(),
            createdAt: z.string(),
            
          }),
        },
      },
      description: 'delete post response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(returnAllPostsRoute, (c) => {
  return c.json(
    {
      content: 'backend on express',
      userId: 1,
      title: 'devops',
      tags: [{}],
      id: 1,
      createdAt: new Date()
    },
    200
  )
})

const postsByTagsRoute = createRoute({
  method: 'get',
  path: '/tags/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            tagQuery: z.string()
            
          }),
        },
      },
      description: 'posts by tags response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(postsByTagsRoute, (c) => {
  return c.json(
    {
    tagQuery: 'dev'
    },
    200
  )
})

const searchPostRoute = createRoute({
  method: 'get',
  path: '/search/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            searchQuery: z.string()
            
          }),
        },
      },
      description: 'change post response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(searchPostRoute, (c) => {
  return c.json(
    {
    searchQuery:'backend'
    },
    200
  )
})

const postWithCommentsRoute = createRoute({
  method: 'get',
  path: '/comments/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            comments: z.object({}).array(),
            content: z.any(),
            userId: z.number(),
            title: z.any(),
            postId: z.number(),
            id: z.number(),
            createdAt: z.string(),
            
          }),
        },
      },
      description: 'change post response',
    },
  },
  tags: ['posts'], // <- Add tag here
})

post.openapi(postWithCommentsRoute, (c) => {
  return c.json(
    {
      comments:[{}],
      content: 'backend on express',
      userId: 1,
      postId: 1,
      title: 'devops',
      tags: [{}],
      id: 1,
      createdAt: new Date()
    },
    200
  )
})
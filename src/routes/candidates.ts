import { Hono } from 'hono'
import { jwtAuth } from '../middlewares'
import { app, EmailService, prisma } from '..'
import { transformStringsToObjects } from '../helpers'
import { ApplicationStatus } from '@prisma/client'
import { vacancy } from './vacancy'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

export const candidates = new OpenAPIHono()

candidates.use(jwtAuth())

candidates.get('/search', async (c) => {
  const searchQuery = c.req.query('searchQuery') || ''

  try {
    const result = await prisma.user.findMany({
      where: {
        type: 'APPLICANT',

        applicant: {
          skills: {
            has: `${searchQuery[0].toUpperCase()}${searchQuery.slice(1)}`,
          },
        },
      },
      include: {
        applicant: true,
      },
    })

    const formattedCandidates = result.map((user) => {
      const { refreshToken, applicant, password, type, ...userData } = user
      return {
        ...userData,
        gitHubLink: applicant?.gitHubLink,
        skills: transformStringsToObjects(applicant?.skills),
      }
    })
    return c.json(formattedCandidates)
  } catch (error) {
    return c.json({ message: 'Something went wrong' }, 500)
  }
})

candidates.get('/', async (c) => {
  const result = await prisma.user.findMany({
    where: {
      type: 'APPLICANT',
    },
    include: {
      applicant: true,
    },
  })

  const formattedCandidates = result.map((user) => {
    const { refreshToken, applicant, password, type, ...userData } = user
    return {
      ...userData,
      gitHubLink: applicant?.gitHubLink,
      skills: transformStringsToObjects(applicant?.skills),
    }
  })
  return c.json(formattedCandidates)
})

candidates.get('/candidates-feedback/:vacancyId', async (c) => {
  const filterBy = c.req.query('filterBy') as ApplicationStatus | 'ALL'

  const vacancyId = c.req.param('vacancyId')

  const isFilteredByAll = filterBy === 'ALL'

  let result

  try {
    if (isFilteredByAll) {
      result = await prisma.vacancy.findUniqueOrThrow({
        where: {
          id: Number(vacancyId),
        },
        include: {
          applications: {
            include: {
              applicant: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      })
    } else {
      result = await prisma.vacancy.findUniqueOrThrow({
        where: {
          id: Number(vacancyId),
        },
        include: {
          applications: {
            where: {
              status: filterBy,
            },
            include: {
              applicant: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      })
    }

    const formattedCandidates = result.applications.map((application) => {
      const { password, type, refreshToken, ...userData } =
        application.applicant.user
      const { id, skills, user, userId, ...applicationData } =
        application.applicant
      return {
        ...userData,
        ...applicationData,
        skills: transformStringsToObjects(application.applicant.skills),
        status: application.status,
      }
    })

    return c.json(formattedCandidates)
  } catch (error) {
    console.log(error)
    return c.json({ message: 'Something went wrong' }, 500)
  }
})

candidates.patch('/candidates-feedback/:vacancyId', async (c) => {
  const vacancyId = c.req.param('vacancyId')

  const { status, userId } = await c.req.json()

  try {
    await prisma.user.update({
      where: {
        id: Number(userId),
      },
      include: {
        applicant: {
          include: {
            Application: true,
          },
        },
      },
      data: {
        applicant: {
          update: {
            Application: {
              updateMany: {
                where: {
                  vacancyId: Number(vacancyId),
                },
                data: {
                  status,
                },
              },
            },
          },
        },
      },
    })

    return c.json({status: status})
  } catch (error) {
    console.log(error)
    return c.json({ message: 'Something went wrong' }, 500)
  }
})

candidates.post('/send-email', async (c) => {
  const { userId, status, vacancyId } = await c.req.json()

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: Number(userId),
      },
    })

    const statusText = status === 'APPROVED' ? 'одобрен' : 'отклонен'

    const text = `Твой отклик на <a href="https://hackaton-404.ru/vacancy/${vacancyId}">вакансию</a> ${statusText}`

    await EmailService.sendEmail(user.email, 'Vacancy status', text)
    return c.json({ message: 'Email send' }, 200)
  } catch (error) {
    console.log(error)
    return c.json({ message: 'Something went wrong' }, 500)
  }
})

candidates.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: Number(id),
        type: 'APPLICANT',
      },
      include: {
        applicant: true,
      },
    })

    const { password, refreshToken, applicant,  ...userData } = user

    return c.json({...userData, gitHubLink: applicant?.gitHubLink,   skills: transformStringsToObjects(applicant?.skills)})
  } catch (error) {
    return c.json({ message: 'User not found' }, 404)
  }
})
candidates.get('/candidates-feedback/:vacancyId', async (c) => {
  const vacancyId = c.req.param('vacancyId')

  try {
    const result = await prisma.vacancy.findUniqueOrThrow({
      where: {
        id: Number(vacancyId),
      },
      include: {
        applications: {
          include: {
            applicant: {
              include: {
                user: true,
              }
            }
          }
        }
      }
    })

    const formattedCandidates = result.applications.map((application) => {
      const {password, type, refreshToken,  ...userData} = application.applicant.user
      const {id, skills, user, userId, ...applicationData} = application.applicant
      return {
        ...userData,
        ...applicationData,
        skills: transformStringsToObjects(application.applicant.skills),
      }
    })




    return c.json(formattedCandidates)
  } catch (error) {
    return c.json({ message: 'Something went wrong' }, 500)
  }
})


const searchRoute = createRoute({
  method: 'get',
  path: '/search/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            gitHubLink: z.string(),
            value: z.string(),
            label: z.string(),
            accessToken: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            id: z.number(),
            email: z.string(),
            password: z.string(),
            patronymic: z.string(),
            about: z.string(),
            avatar: z.string(),
            jobExperience: z.object({}).array(),
            type: z.string(),
            createdAt: z.string(),

          }),
        },
      },
      description: 'фрагмент кода для поиска соискателей по определенным параметрам.Условия поиска указываются в объекте where. Ищутся пользователи, у которых:Поле type равно APPLICANT.Вложенное поле skills у applicant содержит (has) навык, который начинается с заглавной буквы и остальной части строки searchQuery.Параметр include указывает, что нужно включить связанные данные из таблицы applicant.Результат запроса форматируется, чтобы удалить чувствительные данные (refreshToken, password) и ненужное поле type. Также включаются дополнительные поля из связанных данных applicant.Форматированный список кандидатов возвращается в виде JSON-ответа.',
    },
  },
  tags: ['candidates'], // <- Add tag here
})

candidates.openapi(searchRoute, (c) => {
  return c.json(
    {
      gitHubLink: 'https://github.com/uglynhumble',
      value:'3123123123',
      label: 'google',
      accessToken: 'sign-up success',
      firstName: 'vasya',
      lastName: 'hershtein',
      id: 1,
      email: 'vasyahershtein@gmail.com',
      password: 'qwerty123123',
      patronymic: 'alekseevich',
      about: 'backend developer',
      avatar: '',
      jobExperience: [{}],
      type: 'recrutieer',
      createdAt: new Date(),
    },
    200
  )
})

const applicantRoute = createRoute({
  method: 'get',
  path: '/applicant/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.number(),
            resume: z.string(),
            projectsList: z.object({}).array(),
            skills: z.string({}),
            gitHubLink: z.string(),
            value: z.string(),
            label: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            id: z.number(),
            email: z.string(),
            patronymic: z.string(),
            about: z.string(),
            avatar: z.string(),
            jobExperience: z.object({}).array(),
            type: z.string(),
            createdAt: z.string(),

          }),
        },
      },
      description: 'фрагмент кода для получения всех аппликантов.Результат запроса форматируется, чтобы удалить чувствительные данные (refreshToken, password) и ненужное поле type. Также включаются дополнительные поля из связанных данных applicant',
    },
  },
  tags: ['candidates'], // <- Add tag here
})

candidates.openapi(applicantRoute, (c) => {
  return c.json(
    {
      userId: 2,
      resume: 'all gucci',
      projectsList: [{}],
      skills: '1231231231231',
      gitHubLink: 'https://github.com/uglynhumble',
      value:'3123123123',
      label: 'google',
      firstName: 'vasya',
      lastName: 'hershtein',
      id: 1,
      email: 'vasyahershtein@gmail.com',
      password: 'qwerty123123',
      patronymic: 'alekseevich',
      about: 'backend developer',
      avatar: '',
      jobExperience: [{}],
      type: 'recrutieer',
      createdAt: new Date(),
    },
    200
  )
})

const candidateFeedbackRoute = createRoute({
  method: 'get',
  path: '/candidates-feedback/:vacancyId/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.number(),
            resume: z.string(),
            projectsList: z.object({}).array(),
            skills: z.string({}),
            gitHubLink: z.string(),
            value: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            email: z.string(),
            patronymic: z.string(),
            about: z.string(),
            avatar: z.string(),
            jobExperience: z.object({}).array(),
            createdAt: z.string(),

          }),
        },
      },
      description: 'Форматирование выполняется следующим образом:Удаляются чувствительные данные (password, refreshToken) и ненужные поля (type) из данных пользователя.Удаляются поля id, user, и userId из данных заявителя.Добавляются дополнительные поля из связанных данных. Поле skills преобразуется из строки в объект с помощью функции transformStringsToObjects.',
    },
  },
  tags: ['candidates'], // <- Add tag here
})

candidates.openapi(candidateFeedbackRoute, (c) => {
  return c.json(
    {
      resume: 'all gucci',
      projectsList: [{}],
      skills: '1231231231231',
      gitHubLink: 'https://github.com/uglynhumble',
      value:'3123123123',
      firstName: 'vasya',
      lastName: 'hershtein',
      id: 1,
      email: 'vasyahershtein@gmail.com',
      password: 'qwerty123123',
      patronymic: 'alekseevich',
      about: 'backend developer',
      avatar: '',
      jobExperience: [{}],
      type: 'recrutieer',
      createdAt: new Date(),
    },
    200
  )
})
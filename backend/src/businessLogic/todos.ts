import 'source-map-support/register'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'
const AWSXRay = require('aws-xray-sdk')

import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { TodoUpdate } from '../models/TodoUpdate'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { createLogger } from '../utils/logger'

const logger = createLogger('Todos')
const XAWS = AWSXRay.captureAWS(AWS)
const docClient = new XAWS.DynamoDB.DocumentClient()

const bucketName = process.env.ATTACHMENT_S3_BUCKET
const todosTable = process.env.TODOS_TABLE
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

export async function getTodosForUser(userId: string): Promise<TodoItem[]> {
  logger.info('started business logic processing', userId)
  const result = await docClient
    .query({
      TableName: todosTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
    .promise()

  let items = result.Items
  items as TodoItem[]

  const response = items.map((item) => {
    item.attachmentUrl = `https://${bucketName}.s3.us-east-1.amazonaws.com/${item.todoId}`
    return item
  })
  logger.info('ended business logic processing', response)
  return response
}

export async function createTodo(
  createTodoRequest: CreateTodoRequest,
  userId: string
): Promise<TodoItem> {
  logger.info('started business logic processing', userId)
  const todoId = uuid.v4()

  const newTodo: TodoItem = {
    userId: userId,
    todoId: todoId,
    createdAt: new Date().toISOString(),
    name: createTodoRequest.name,
    dueDate: createTodoRequest.dueDate,
    done: false
  }

  const response = await this.docClient
    .put({
      TableName: todosTable,
      Item: newTodo
    })
    .promise()

  logger.info('ended business logic processing', response)
  return response
}

export async function updateTodo(
  userId: string,
  todoId: string,
  updateTodoRequest: UpdateTodoRequest
): Promise<TodoUpdate> {
  logger.info('started business logic processing', userId)
  const updatedTodo: TodoUpdate = {
    name: updateTodoRequest.name,
    dueDate: updateTodoRequest.dueDate,
    done: updateTodoRequest.done
  }

  const response = await this.docClient
    .update({
      TableName: todosTable,
      Key: {
        userId: userId,
        todoId: todoId
      },
      UpdateExpression: 'set #n = :t, dueDate=:d, done=:o',
      ExptessionAttributeValues: {
        ':t': updatedTodo.name,
        ':d': updatedTodo.dueDate,
        ':o': updatedTodo.done
      },
      ExpressionAttributeNames: {
        '#n': 'name'
      },
      ReturnValues: 'UPDATED_NEW'
    })
    .promise()

  logger.info('ended business logic processing', response)
  return response
}

export async function deleteTodo(
  userId: string,
  todoId: string
): Promise<void> {
  logger.info('started business logic processing', userId)
  await this.docClient
    .delete({
      TableName: todosTable,
      Key: {
        userId: userId,
        todoId: todoId
      }
    })
    .promise()

  logger.info('ended business logic processing')
}

export async function createAttachmentPresignedUrl(
  userId: string,
  todoId: string
): Promise<String> {
  logger.info('started business logic processing', userId)

  const response = await this.docClient
    .get({
      TableName: todosTable,
      Key: {
        userId: userId,
        todoId: todoId
      }
    })
    .promise()

  if (response.Item) {
    logger.info('ended business logic processing for 404', null)
    return null
  } else {
    const s3 = new XAWS.S3({
      signatureVersion: 'v4'
    })
    let response = s3.getSignedUrl('putObject', {
      Bucket: bucketName,
      Key: todoId,
      Expires: parseInt(urlExpiration)
    })

    logger.info('ended business logic processing for 200', response)
    return response
  }
}

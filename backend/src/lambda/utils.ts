import { APIGatewayProxyEvent } from 'aws-lambda'
import { parseUserId } from '../auth/utils'
const logger = createLogger('Todos')
import { createLogger } from '../utils/logger'

/**
 * Get a user id from an API Gateway event
 * @param event an event from API Gateway
 *
 * @returns a user id from a JWT token
 */
export function getUserId(event: APIGatewayProxyEvent): string {
  logger.info('started get user id util processing', event)
  const authorization = event.headers.Authorization
  const split = authorization.split(' ')
  const jwtToken = split[1]

  const parsedUserId = parseUserId(jwtToken)
  logger.info('ended business logic processing', parsedUserId)
  return parsedUserId
}

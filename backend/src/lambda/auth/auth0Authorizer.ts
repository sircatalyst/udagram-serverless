import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify, decode } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import Axios from 'axios'
import { Jwt } from '../../auth/Jwt'
import { JwtPayload } from '../../auth/JwtPayload'

const logger = createLogger('auth')
// import * as util from 'util';

// TODO: Provide a URL that can be used to download a certificate that can be used
// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
const jwksUrl = 'https://dev-h6lok52y.us.auth0.com/.well-known/jwks.json'

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    logger.error('User not authorized', { error: e.message })

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader)
  const jwt: Jwt = decode(token, { complete: true }) as Jwt

  // TODO: Implement token verification
  // You should implement it similarly to how it was implemented for the exercise for the lesson 5
  // You can read more about how to do this here: https://auth0.com/blog/navigating-rs256-and-jwks/

  if (!authHeader) throw new Error('No authorization Token provided')

  if (!authHeader.toLowerCase().startsWith('bearer'))
    throw new Error('Invalid authentication header')

  logger.info('fetching Certificate')
  let certificate = await getASigningKey(jwt.header.kid)
  certificate = `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----\n`
  logger.info('Received Certificate', { cert: certificate })

  return verify(token, certificate, { algorithms: ['RS256'] }) as JwtPayload
}

async function getASigningKey(kid: String): Promise<string> {
  logger.info('getting Signing key', { kid: kid })

  const response = await Axios.get(jwksUrl, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    }
  })

  logger.info('Received response ', {
    url: jwksUrl,
    response: JSON.stringify(response.data)
  })

  if (response.status != 200) {
    logger.error('Error get signing-key', { err: JSON.stringify(response) })
    throw new Error(response.statusText)
  }

  const secret = response.data.keys.filter((key) => {
    return key.kid === kid
  })

  logger.info('Filtered secret from response', {
    secret: secret,
    cert: secret[0].x5c
  })
  if (!secret) {
    logger.error('Error fetching secret')
    throw new Error('Error fetching secret')
  }

  return secret[0].x5c[0]
}

function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}

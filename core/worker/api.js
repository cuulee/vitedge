import fns from '__vitedge_functions__'
import { getCachedResponse, setCachedResponse } from './cache'
import { createResponse, createNotFoundResponse } from './utils'

const API_PREFIX = '/api'

function normalizeRoute(pathname) {
  // Remove trailing slashes and file extensions
  return pathname.replace(/(\/|\.\w+)$/, '')
}

export function isApiRequest(event) {
  const pathname = normalizeRoute(new URL(event.request.url).pathname)

  return (
    pathname.startsWith(API_PREFIX + '/') ||
    Object.prototype.hasOwnProperty.call(fns, pathname)
  )
}

export function parseQuerystring(event) {
  const url = new URL(event.request.url)
  // Parse querystring similarly to Express or Rails (there's no standard for this)
  const query = Array.from(url.searchParams.entries()).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value,
    }),
    {}
  )

  return { url, query }
}

function buildApiResponse(data, options) {
  options = options || {}

  const headers = {
    'content-type': 'application/json;charset=UTF-8',
    ...(options.headers || {}),
  }

  if ((headers['content-type'] || '').startsWith('application/json')) {
    data = JSON.stringify(data)
  }

  return createResponse(data, {
    status: options.status || 200,
    headers,
  })
}

export async function handleApiRequest(event) {
  const cacheKey = event.request.url
  const cachedResponse = await getCachedResponse(cacheKey)
  if (cachedResponse) {
    return cachedResponse
  }

  const url = new URL(event.request.url)
  const endpoint = normalizeRoute(url.pathname)

  if (Object.prototype.hasOwnProperty.call(fns, endpoint)) {
    const { handler, options: staticOptions } = fns[endpoint]

    const { url, query } = parseQuerystring(event)
    const { data, options: dynamicOptions } = await handler({
      event,
      request: event.request,
      headers: event.request.headers,
      url,
      query,
    })

    const options = Object.assign({}, staticOptions || {}, dynamicOptions || {})

    const response = buildApiResponse(data, options)

    setCachedResponse(
      event,
      response,
      cacheKey,
      ((options && options.cache) || {}).api
    )

    return response
  }

  return createNotFoundResponse()
}

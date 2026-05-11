import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('pages/Homepage.tsx'),
  route('letters/:senderId?/:letterId?/:pageId?', 'pages/Letters.tsx'),
  route('photos', 'pages/Photos.tsx'),
] satisfies RouteConfig

import { RenderMode, ServerRoute } from '@angular/ssr';

// La sesión (token) vive en localStorage, que no existe en el servidor. Si las
// rutas protegidas se prerenderizan, los guards corren sin token y el servidor
// responde con un redirect a /auth/login en cada recarga (F5, pestaña nueva o
// recarga del dev server), cerrando la sesión. Por eso solo el login se
// prerenderiza; el resto se renderiza en el navegador, donde sí está el token.
export const serverRoutes: ServerRoute[] = [
  {
    path: 'auth/login',
    renderMode: RenderMode.Prerender
  },
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];

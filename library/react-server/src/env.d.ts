// src/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_API_URL: string;
    PORT_EXPRESS: string;
    // Add other variables as needed
  }
}

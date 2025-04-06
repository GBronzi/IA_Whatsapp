#!/bin/bash

# Generar secretos si no existen
if [ ! -f .env ]; then
  echo "Generando archivo .env con secretos..."
  JWT_SECRET=$(openssl rand -base64 32)
  ADMIN_KEY=$(openssl rand -base64 16)
  
  echo "# Configuración del servidor" > .env
  echo "PORT=3000" >> .env
  echo "" >> .env
  echo "# Clave secreta para JWT" >> .env
  echo "JWT_SECRET=$JWT_SECRET" >> .env
  echo "" >> .env
  echo "# Clave para crear usuario administrador" >> .env
  echo "ADMIN_KEY=$ADMIN_KEY" >> .env
  
  echo "Archivo .env generado con éxito."
  echo "ADMIN_KEY: $ADMIN_KEY (guárdala en un lugar seguro)"
fi

# Iniciar servidor con Docker Compose
docker-compose up -d

echo "Servidor de licencias iniciado en http://localhost:3000"
echo "Para crear un usuario administrador, usa la siguiente URL:"
echo "http://localhost:3000/api/create-admin con la clave de administrador del archivo .env"

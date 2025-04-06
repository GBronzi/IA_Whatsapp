#!/bin/bash

# Crear directorio para certificados SSL
mkdir -p ssl

# Generar clave privada
openssl genrsa -out ssl/key.pem 2048

# Generar solicitud de certificado
openssl req -new -key ssl/key.pem -out ssl/csr.pem -subj "/C=ES/ST=Madrid/L=Madrid/O=AsistenteVentasWhatsApp/CN=localhost"

# Generar certificado autofirmado (válido por 365 días)
openssl x509 -req -days 365 -in ssl/csr.pem -signkey ssl/key.pem -out ssl/cert.pem

# Eliminar archivo CSR
rm ssl/csr.pem

# Actualizar permisos
chmod 600 ssl/key.pem
chmod 600 ssl/cert.pem

echo "Certificados SSL generados correctamente en el directorio 'ssl'"
echo "Para habilitar SSL, edita el archivo .env y establece SSL_ENABLED=true"

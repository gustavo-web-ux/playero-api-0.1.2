# Utiliza la imagen base de Node.js versión 18.18.0
FROM node:18.18.0

# Instala Python
RUN apt-get update && \
    apt-get install -y python3

# Configura Node.js para encontrar Python
ENV PYTHON /usr/bin/python3

# Establece el directorio de trabajo en /usr/src/app
WORKDIR /usr/src/app

# Copia el archivo package.json y package-lock.json al directorio de trabajo
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia todos los archivos y carpetas del directorio actual al directorio de trabajo
COPY . .

# Expone el puerto 3000 para que la aplicación pueda ser accedida desde fuera del contenedor
EXPOSE 4080

# Comando para ejecutar la aplicación
CMD ["npm", "start"]


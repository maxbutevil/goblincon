
#164.90.245.50
#git clone git@github.com:maxbutevil/goblincon-plus

#git reset --hard HEAD && git pull
#docker build -t goblincon .
#docker run -p 443:5050 --name goblincon goblincon

#docker stop goblincon
#docker remove goblincon

FROM node:latest AS client
WORKDIR /client
COPY ./client .
RUN npm install
RUN npm run build

FROM rust:latest
WORKDIR /goblincon
COPY ./server .
RUN cargo install --path .

COPY --from=client /client/dist ../client/dist
EXPOSE 5050

CMD [ "server" ]

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

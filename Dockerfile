#git clone git@github.com:maxbutevil/goblincon-plus
#docker build -t goblincon .
#docker run -p 5050:5050 --name goblincon goblincon


FROM node:latest AS client
WORKDIR /src/client
COPY ./client .
RUN npm install
RUN npm run build

FROM rust:latest AS server
WORKDIR /src
COPY --from=client /src/client/dist ./client/dist
COPY ./src ./src
COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml
COPY ../.env ./.env
COPY ../tls/ ./tls
RUN cargo build --release

EXPOSE 5050

CMD [ "cargo", "run", "--release" ]

#FROM ubuntu:latest
#WORKDIR /goblincon
#COPY --from=client /src/client/dist ./client/dist
#COPY --from=server /src/server/target/release/server.exe ./server
#EXPOSE 5050
#CMD ["./server"]
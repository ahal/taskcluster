FROM node:18.18.2

WORKDIR /app/ui
COPY yarn.lock package.json ./

RUN corepack enable
RUN yarn

ENTRYPOINT [ "yarn" ]
CMD [ "start:docker" ]

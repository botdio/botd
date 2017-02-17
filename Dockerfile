FROM node:4
RUN rm /bin/sh && ln -s /bin/bash /bin/sh
ENV appDir /var/botd/current
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 4.2.0
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.0/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN mkdir -p /var/botd/current
WORKDIR ${appDir}

ADD package.json ./
RUN npm i --production
ADD . /var/botd/current

CMD ["node", "./botd.js -h"]
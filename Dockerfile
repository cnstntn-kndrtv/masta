FROM node:latest

# pull app
RUN git clone https://github.com/cnstntn-kndrtv/owsama.git
WORKDIR /owsama

RUN npm install

CMD npm start
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import minimist from 'minimist';
import { timeout } from './common';
import cors from 'cors';

const serverStartTime = new Date(Date.now()).toISOString();
let latestRequestTime: string | undefined;

const defaultPort = 4000;
const defaultDelay = 0;
type ServerArgs = {
  p: number,
  delay: number,
}
const args = minimist<ServerArgs>(process.argv.slice(2), {
  default: {
    p: defaultPort,
    delay: defaultDelay
  }
});

const port: number = args.p;
const delay: number = args.delay;
const path = '/graphql';

const schema = buildSchema(`
  type Query {
    info: String
  }
`);

const root = {
  info: () => {
    const info = `Server started on ${serverStartTime} on port ${port}. ${latestRequestTime ? `Latest request time ${latestRequestTime}` : ''}`;
    latestRequestTime = new Date(Date.now()).toISOString();

    return info;
  },
};

const app = express();
app.use(cors({
  methods: ['POST', 'GET']
}));
app.use(path, graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

timeout(delay).then(() => {
  app.listen(port);

  console.log(`Running a GraphQL API server at port "${port}" and path "${path}"`);
});
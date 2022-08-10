import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import minimist from 'minimist';

const serverStartTime = new Date(Date.now()).toISOString();
let latestRequestTime: string | undefined;

const defaultPort = 4000;
type ServerArgs = {
  p: number
}
const args = minimist<ServerArgs>(process.argv.slice(2), {
  default: {
    p: defaultPort, 
  }
});

const port: number = args.p;
const path = '/graphql';

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    info: String
  }
`);

// The root provides a resolver function for each API endpoint
const root = {
  info: () => {
    const info = `Server started on ${serverStartTime} on port ${port}. ${latestRequestTime ? `Latest request time ${latestRequestTime}` : ''}`;
    latestRequestTime = new Date(Date.now()).toISOString();

    return info;
  },
};

const app = express();
app.use(path, graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

app.listen(port);

console.log(`Running a GraphQL API server at port "${port}" and path "${path}"`);
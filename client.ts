import { gql, GraphQLClient } from 'graphql-request';
import axios from 'axios';

const commands: Record<string, () => Promise<void>> = {
  handshake: async () => {
    const resPayload = await axios.get('http://localhost:4000/handshake');
    const uid = resPayload.data.uid;

    console.log(`Process uid: ${uid}`);
  },
  info: async () => {
    const query = gql`
      query {
        info
      }
    `
    const uid = process.argv[3];
    const client = new GraphQLClient('http://localhost:4000/graphql', {
      headers: {
        'X-Serv-Uid': uid,
      }
    })
    const res = await client.request<{ info: string }>(query);
    console.log(`info received: ${res.info}`);
  },
  ping: async () => {

  }
};

async function main() {
  const commandName = process.argv[2];

  const command = commands[commandName];
  if (!command) {
    throw new Error('incorrect command');
  }

  await command();
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });


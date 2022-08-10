## Example of reverse proxy - node + typescript + graphql

A reverse proxy in node + typescript which launches graphql instances. An example usage in form of node client is also provided.

Flow of operations:

- `yarn install` - install dependencies
- `yarn build` - build `.ts` files into `.js` files (`build` directory)
- `yarn proxy` - launches proxy on `4000` port
- `yarn client -- handshake` - client initiates handshake - proxy spins up a new `server` instance, assigns it `uid` and returns the `uid`
- `yarn client -- info <uid>` - client asks for info using `uid` returned from the previous handshake
## Example of reverse proxy using node + typescript + graphql

A reverse proxy in node + typescript which launches graphql instances. An example usage in form of node client is also provided.
Proxy has timeout of 30s implemented which, after which proxy kills the server instance due to inactivity.
The timeout can be restarted from client either by making ping request or just a regular graphql request.

Flow of operations:

- `yarn install` - install dependencies
- `yarn build` - build `.ts` files into `.js` files (`build` directory)
- `yarn proxy` - launches proxy on `4000` port
- `yarn client -- handshake` - client initiates handshake - proxy spins up a new `server` instance, assigns it `uid` and returns the `uid`
- `yarn client -- info <uid>` - client asks for info using `uid` returned from the previous handshake. Restarts the worker timeout.
- `yarn client -- ping <uid>` - client asks to restart the timeout for worker with `uid`

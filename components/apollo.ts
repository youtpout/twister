import { ApolloClient, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
    uri: "https://api.studio.thegraph.com/query/65791/twister/v0.0.2",
    cache: new InMemoryCache(),
});

export default client;
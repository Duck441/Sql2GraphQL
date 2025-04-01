# Sql2GraphQL

Generates a Graphql schema and resolvers from an existing relational database

## Query example

```gql
query {
  getPageUsers(
    filter: "id#1,2,3"
    pagination: "limit=2;orderby=username desc"
    _debug: true
  ) {
    items {
      id
      username
      fullname(foo: "hello ")
      password
      posts(filter: "publish=true", _cache: false) {
        total
        items {
          title
          publish
          categories {
            title
          }
        }
      }
    }
  }
}
```

## Limitations/TODO

* Only PostgreSQL, MySQLand MSSql supported
* Better database types handling
* Better database queries optimization
* Move to TypeScript
* Improve convenient API methods.

## Example

```sql
CREATE TABLE foo (
  id serial,
  name BOOLEAN
);
CREATE TABLE bar (
  id serial,
  foo_id integer
);
ALTER TABLE bar ADD CONSTRAINT fk_bar_foo_1 FOREIGN KEY (foo_id) REFERENCES foo (id) ON UPDATE CASCADE ON DELETE CASCADE;
```

**Generated Graphql Schema**  
**NOTE:** "Foo" and "Bar" is the converted tablenames to CamelCase

```gql
type Query {

  getPageBar(
    filter: String
    pagination: String
    where: Condition
    _debug: Boolean
    _cache: Boolean
  ): PageBar

  getFirstBar(
    filter: String
    pagination: String
    where: Condition
    _debug: Boolean
    _cache: Boolean
  ): Bar

  getPageFoo(
    filter: String
    pagination: String
    where: Condition
    _debug: Boolean
    _cache: Boolean
  ): PageFoo

  getFirstFoo(
    filter: String
    pagination: String
    where: Condition
    _debug: Boolean
    _cache: Boolean
  ): Foo

}

type Mutation {

  putItemBar(
    input: Bar!
    _debug: Boolean
  ): Bar

  putItemFoo(
    input: Foo!
    _debug: Boolean
  ): Foo

}

type Condition {
  sql: String!
  val: [String!]
}

type PageBar {
  total: Int
  items: [Bar]
}

type PageFoo {
  total: Int
  items: [Foo]
}

type Bar {
  id: Int
  foo_id: Int
  foo_id_foo: Foo
}

type Foo {
  id: Int
  name: String
}
```

## Filter Examples

Graphql

```gql
{ getPageFoo(filter: "field1[op1]value1;field2[op2]value2") }
```

SQL

```sql
WHERE foo.field1 [op1] value1 AND foo.field2 [op2] value2 
```

Where [op] matches /\<\=\>|>=|<=|=|>|<|~|\#/  

Graphql

```gql
{ getPageFoo(filter: "id#1,2,3") }
```

SQL

```sql
WHERE foo.name IN (1,2,3)
```

Graphql

```gql
{ getPageFoo(filter: "name~my name is foo") }
```

SQL

```sql
WHERE foo.name ilike "my name is foo"
```

## Where Example

Graphql

```gql
query getPageFoo($where: Condition) {
  getPageFoo(where: $where): PageFoo
}
```

Variables

```json
{
  "where": {
    "sql": "tablename.field1 IN (?,?) AND tablename.field2 > (SELECT field FROM tablename WHERE id > ?)",
    "val": ["1","2","3"]
  }
}
```

## Pagination Example

Graphql

```gql
query getPageFoo($pagination: String) {
  getPageFoo(pagination: $pagination): PageFoo
} }
```

Variables

```json
{
  "pagination": "limit=10;offset=2;order by=title desc"
}
```

SQL

```sql
ORDER BY title desc LIMIT 10 OFFSET 2
```

## Usage

### Generate a Graphql schema from an existing relational database

```js
const knex = require('knex');
const Sql2G = require('Sql2GraphQL');
const conn = knex(require('./connection.json'));
const api = new Sql2G('schema', conn);
api.connect().then(() => {
  const schema = api.getSchema();
  console.log(schema);
  conn.destroy();
});
```

### Connect to Mysql database, please supply database name in connect method

```js
api.connect('database_name').then(() => {
  const schema = api.getSchema();
  console.log(schema);
  conn.destroy();
});
```

#### Complete example with Apollo Server

```js
const knex = require('knex');
const Sql2G = require('Sql2GraphQL');
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');

const start = async (cb) => {

  /**************************************/
  const api = new Sql2G('schema', knex(require('./connection.json')));
  await api.connect(); // Connects to database and extracts database schema

  // Set authorization hook example
  const validator = async (type, field, parent, args, context) => {
    return true; // Should return true/ false
  }
  const denied = async (type, field, parent, args, context) => {
    throw new Error('Access Denied'); // Denied callback
  }
  api.isAuthorized(validator, denied);

  // Example of adding extra field
  api.addField('Users.fullname', 'String', (parent, args, context) => {
    return String(args.foo + parent.username);
  }, { foo: 'String' });

  // Example of overiding existing schema
  api.addField('Users.password', 'String', () => '');

  // Get generated schema and resolvers
  const schema = api.getSchema();
  const resolvers = api.getResolvers();
  /**************************************/

  // Create Apollo Server and start
  if (!schema) throw new Error('Error: empty schema');
  console.log(schema);
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers,
  });
  startStandaloneServer(server).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();
```

### Example without database connection

```js
const Sql2G = require('Sql2GraphQL');
const api = new Sql2G('demo');

// Add a query and resolver
api.addField('Query.getFoo', 'Boolean', async (root, args, context) => {
  return true;
}, { param: 'String!' });

// Ready to generate schema
const schema = api.getSchema();
const resolvers = api.getResolvers();
```

## License

MIT, what else?

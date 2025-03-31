const utils = require('../utils/utils');

/**
 * Graphql compiler
 *
 * Compiles to a Graphql schema string
 * from a database schema generated
 * by a database adapter
 */
class Compiler  {
  /**
   * Creates a new compiler instance
   *
   * @param {Object} dbSchema
   * @param {Function} dbDriver
   */
  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;

    // Hold schema
    this.schema = { type: {}, input: {} };

    // Cache sdl
    this.sdl = '';
  }

  /**
   * Build gql params string from an object
   *
   * @param {Object} obj
   */
  //  async function hhbuildParamsFromObject(obj, join = ', ') {
  //   let params = [];
  //    Object.keys(await obj).forEach((k) => params.push(k + ': ' + obj[k]));
  //   return params.length ? '(' + params.join(join) + ')' : '';
  // }
  buildParamsFromObject(obj, join = ', ') {
    let params = [];
     Object.keys(obj).forEach((k) => params.push(k + ': ' + obj[k]));
    return params.length ? '(' + params.join(join) + ')' : '';
  }
  /**
   * Builds a gql string for query/mutation
   *
   * @param {String} name
   * @param {String} returns
   * @param {Object} params
   */
  buildQuery(name, returns, params) {
    params = this.buildParamsFromObject(params);
    const gql = `${name}${params}: ${returns}`;
    return gql;
  }

  /**
   * Generate a Graphql Type definition
   * from a database table
   *
   * @param {String} tablename
   */
   async mapDbTableToGraphqlType(tablename) {
    const field = utils.toCamelCase(tablename);
    if (!this.schema.type[field]) this.schema.type[field] = {};
    let columns = await this.dbDriver.getTableColumnsFromSchema(tablename);
    await columns.forEach((child) => {
      try {
        this.schema.type[field][child] = {
          name: child,
          type: this.dbDriver.mapDbColumnToGraphqlType(
            child,
            this.dbSchema[tablename][child]
          ),
          params: {}
        };
      } catch (err) {} 
    });
    // Add foreign relations
    columns.map((c) => {
      let column = this.dbSchema[tablename][c];
      if (column.__foreign) {
        let child = c + '_' + column.__foreign.tablename;
        this.schema.type[field][child] = {
          name: child,
          type: utils.toCamelCase(column.__foreign.tablename),
          params: {}
        };
      }
    });
    
    // Add reverse relation
    this.dbSchema[tablename].__reverse.map((r) => {
      let child = r.ftablename;
      this.schema.type[field][child] = {
        name: child,
        type: utils.toCamelCase(child) + 'Page',
        params: {
          filter: 'String',
          pagination: 'String',
          where: 'Condition',
          _debug: 'Boolean',
          _cache: 'Boolean'
        }
      };
    });
    
    // Add pages
    this.schema.type[field + 'Page'] = {
      total: {
        name: 'total',
        type: 'Int',
        params: {}
      },
      items: {
        name: 'items',
        type: [field]
      }
    };
  }

  /**
   * Create a convenient GetPage field
   * for paginated results
   *
   * @param {String} tablename
   */
   async mapDbTableToGraphqlQuery(tablename) {
    const field = await utils.toCamelCase(tablename);
    const params = {
      filter: 'String',
      pagination: 'String',
      where: 'Condition',
      _debug: 'Boolean',
      _cache: 'Boolean'
    };
    if (!this.schema.type.Query) this.schema.type['Query'] = {};
    this.schema.type.Query[field + 'GetPage'] = {
      name: field + 'GetPage',
      type: field + 'Page',
      params
    };
  }
  
  /**
   * Create a convenient GetFirstOf field
   * to get only one record from database.
   *
   * Uses a simple filter that can be used
   * on Unique columns
   *
   * @param {String} tablename
   */
   async mapDbTableToGraphqlFirstOf(tablename) {
    const field = await utils.toCamelCase(tablename);
    const params = {
      filter: 'String',
      pagination: 'String',
      where: 'Condition',
      _debug: 'Boolean',
      _cache: 'Boolean'
    };
    if (!this.schema.type.Query) this.schema.type['Query'] = {};
    this.schema.type.Query[field + 'GetFirst'] = {
      name: field + 'GetFirst',
      type: field,
      params
    };
  }

  /**
   * Generate input name from tablename
   *
   * @param {String} tablename
   */
  async getInputName(tablename) {
    const field = await utils.toCamelCase(tablename);
    const name = field + 'Input';
    return name;
  }

  /**
   * Create a convenient input to be used in mutation
   *
   * @param {String} tablename
   */
   async mapDbTableToGraphqlInput(tablename) {
    const name = await this.getInputName(tablename);
    if (!this.schema.input[name]) this.schema.input[name] = {};
    let columns = await this.dbDriver.getTableColumnsFromSchema(tablename);
    await columns.forEach((col) => {
      try {
        this.schema.input[name][col] = this.dbDriver.mapDbColumnToGraphqlType(
          col,
          this.dbSchema[tablename][col]
        );
      } catch (err) {}
    });
  }

  /**
   * Create a convenient mutation putItem
   * to store a single record into the database
   *
   * @param {String} tablename
   */
   async mapDbTableToGraphqlMutation(tablename) {
    const field = await utils.toCamelCase(tablename);
    if (!this.schema.type.Mutation) this.schema.type['Mutation'] = {};
    let name = await this.getInputName(tablename);
    let params = { _debug: 'Boolean', input: name + '!' };
    this.schema.type.Mutation[field + 'PutItem'] = {
      name: field + 'PutItem',
      type: field,
      params
    };
  }

  /**
   * Adds a Graphql field in types
   *
   * @param {String} field
   */
  addType(type, field, returns, params) {
    if (!this.schema.type[type]) this.schema.type[type] = {};
    this.schema.type[type][field] = {
      name: field,
      type: returns,
      params
    };
  }

  /**
   * Add input field
   *
   * @param {String} input
   * @param {String} field
   * @param {String} subType
   */
  addInput(input, field, subType) {
    if (!this.schema.input[input]) this.schema.input[input] = {};
    this.schema.input[input][field] = subType;
  }

  /**
   * Generate a complete SDL schema as a string.
   * Can be used as standalone.
   */
   buildSchema() {
    if (!this.dbSchema) return this.schema;
    for (let tablename in this.dbSchema) {
      this.mapDbTableToGraphqlType(tablename);
      this.mapDbTableToGraphqlQuery(tablename);
      this.mapDbTableToGraphqlFirstOf(tablename);
      this.mapDbTableToGraphqlMutation(tablename);
      this.mapDbTableToGraphqlInput(tablename);
    }
    return this.schema;
  }

  async async_buildSchema() {
    if (!this.dbSchema) return this.schema;
    for (let tablename in await this.dbSchema) {
      await this.mapDbTableToGraphqlType(tablename);
      await this.mapDbTableToGraphqlQuery(tablename);
      await this.mapDbTableToGraphqlFirstOf(tablename);
      await this.mapDbTableToGraphqlMutation(tablename);
      await this.mapDbTableToGraphqlInput(tablename);
    }
    return this.schema;
  }

  async buildSchemaByTable(tablename) {
    if (!this.dbSchema) return this.schema;
    await this.mapDbTableToGraphqlType(tablename);
    await this.mapDbTableToGraphqlQuery(tablename);
    await this.mapDbTableToGraphqlFirstOf(tablename);
    await this.mapDbTableToGraphqlMutation(tablename);
    await this.mapDbTableToGraphqlInput(tablename);
    return this.schema;
  }

  /**
   * Generate a complete SDL schema as a string.
   * Can be used as standalone.
   */
  async getSDL(refresh = false) {
    if (!this.sdl || refresh) {
      this.sdl = '';
      let items = [];
      
      // Build SDL types
      for (let field in this.schema.type) {
        let subfields = [];
        Object.keys(await this.schema.type[field]).map((key) => {
          let f = this.schema.type[field][key];
          let type = Array.isArray(f.type) ? '[' + f.type[0] + ']' : f.type;

          subfields.push(
            '  ' +
              f.name +
              this.buildParamsFromObject(f.params || {}) +
              ': ' +
              type
          );
        });
        items.push('type ' + field + ' {\n' + subfields.join('\n') + '\n}');
      }

      // Build SDL inputs
      for (let field in this.schema.input) {
        let subfields = [];
       Object.keys(await this.schema.input[field]).map((key) => {
          subfields.push('  ' + key + ': ' + this.schema.input[field][key]);
        });
        items.push('input ' + field + ' {\n' + subfields.join('\n') + '\n}');
      }

      this.sdl = items.join('\n\n');

      // Add condition type
      // if (items.length) {
      //   this.sdl +=
      //     '\n\ninput Condition {\n  sql: String!\n  val: [String!]!\n}';
      // }

      this.sdl += '\n';
    }
    return this.sdl.trim();
  }





}
async function as_buildParamsFromObject(obj) {

  return await this.buildParamsFromObject(obj || {});
}
module.exports = Compiler;

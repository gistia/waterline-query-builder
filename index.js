const OPERATORS = {
  eq:       { op: undefined },
  ne:       { op: '!=' },
  contains: { op: 'contains' },
  lt:       { op: '<' },
  lte:      { op: '<=' },
  gt:       { op: '>' },
  gte:      { op: '>=' },
  in:       { op: undefined, transform: (value) => typeof value === 'string' ? value.split(',') : value,  },
};

const LOG_OPERATORS = {
  and: 'and',
  or: 'or',
};

const FILTERS_KEYWORDS = ['page', 'limit', 'sort', '_op', '_fields'];
const REGEX_ISO_8601 = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;

const castValues = (value, transform) => {
  value = transform ? castValues(transform(value)) : value
  if (value === 'null') {
    return null;
  } else if (typeof value === 'string' && (match = value.match(REGEX_ISO_8601))) {
    var milliseconds = Date.parse(match[0]);
    if (!isNaN(milliseconds)) {
      return new Date(milliseconds);
    }
  } else if (Array.isArray(value)) {
    return value.map((v) => castValues(v));
  } else {
    return value;
  }
};

const getFilters = (query) => {
  const operator = getOperator(query);
  const filters = Object.keys(query)
    .filter(key => !FILTERS_KEYWORDS.includes(key))
    .reduce((acc, key) => {
      const field = key.split('.');
      const filterOperator = Object.keys(OPERATORS).includes(field[field.length - 1]) ? field.pop() : 'eq';
      const { op, options, transform } = OPERATORS[filterOperator];
      const values = castValues(query[key], transform);
      (Array.isArray(values) && filterOperator !== 'in' ? values : [values]).forEach((value) => {
        const filter = op ? { [op]: value } : value;
        if (options) { Object.assign(filter,  options) };
        acc[operator].push({ [field.join('.')]: filter });
      })

      return acc;
    }, { [operator] : [] });

  return filters[operator].length ? filters : {};
};

const getPagination = (query) => {
  if (query.limit === 'null') {
    return undefined;
  }

  const page = Number(query.page || 1);
  const pageSize = Number(query.limit || 10);

  return {
    limit: pageSize,
    skip: (page - 1) * pageSize,
  };
};

const getSort = (query) => (
  query.sort ? transformSort(query.sort.split(',')) : undefined
);

const getOperator = (query) => {
  const { _op='and' } = query;
  return LOG_OPERATORS[_op] ? LOG_OPERATORS[_op] : LOG_OPERATORS.and;
};

const getFields = (query) => {
  const { _fields } = query;

  if(!_fields) {
    return undefined
  }
  return _fields.split(',').map(a => a.trim());
}

const transformSort = (sort) => {
  const regex = /^(.*?)(?:\s(ASC|DESC))?$/;
  if (!sort) {
    return {};
  }
  return sort.reduce((hash, term) => {
    const re = regex.exec(term);
    const field = re[1].trim();
    const order = (re[2] || 'ASC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    hash[field] = order;
    return hash;
  }, {});
};

const transformToInt = (value) => {
  const integer = new Number(value) + 0;
  return !isNaN(integer) ? integer : value;
};

class QueryBuilder {
  static build(query) {
    const where = getFilters(query);
    const pagination = getPagination(query);
    const sort = getSort(query);
    const select = getFields(query);

    return {
      pagination,
      where,
      sort,
      select,
    };
  }
}

module.exports = QueryBuilder;

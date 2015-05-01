///<reference path="typings/node/node.d.ts"/>
var Jsoql;
(function (Jsoql) {
    var Parse;
    (function (_Parse) {
        var parser = require('./jsoql-parser').parser;
        function Parse(source) {
            return parser.parse(source);
        }
        _Parse.Parse = Parse;
    })(Parse = Jsoql.Parse || (Jsoql.Parse = {}));
})(Jsoql || (Jsoql = {}));
var Jsoql;
(function (Jsoql) {
    var fs = require('fs');
    var Utilities;
    (function (Utilities) {
        function IsArray(value) {
            return Object.prototype.toString.call(value) === '[object Array]';
        }
        Utilities.IsArray = IsArray;
        function ReadFirstLineSync(filepath, maxChars) {
            if (maxChars === void 0) { maxChars = 1024; }
            if (maxChars > 1024)
                throw new Error('Maximum number of chars for first line must be 1024 or less');
            var buffer = new Buffer(1024);
            var fd = fs.openSync(filepath, 'r');
            var bytesRead = fs.readSync(fd, buffer, 0, maxChars, 0);
            return buffer.toString('utf8').split(/\r?\n/)[0];
        }
        Utilities.ReadFirstLineSync = ReadFirstLineSync;
    })(Utilities = Jsoql.Utilities || (Jsoql.Utilities = {}));
})(Jsoql || (Jsoql = {}));
///<reference path="typings/node/node.d.ts"/>
var Jsoql;
(function (Jsoql) {
    var DataSources;
    (function (DataSources) {
        var fs = require('fs');
        var path = require('path');
        var csv = require('csv-string');
        var lazy = require('lazy.js');
        var FileDataSource = (function () {
            function FileDataSource() {
            }
            FileDataSource.prototype.GetLineMapper = function (filePath, parameters) {
                var extension = path.extname(filePath);
                //csv
                if (extension.toLowerCase() == '.csv' || (parameters.format && parameters.format.toLowerCase() == 'csv')) {
                    var headers;
                    var skip;
                    //Explicit headers
                    if (parameters.headers) {
                        headers = parameters.headers.split(',');
                        skip = 0;
                    }
                    else {
                        var firstLine = Jsoql.Utilities.ReadFirstLineSync(filePath);
                        headers = csv.parse(firstLine)[0];
                        skip = 1;
                    }
                    //Use explicit skip if provided
                    if (parameters.skip) {
                        skip = parseInt(parameters.skip);
                        if (isNaN(skip))
                            throw new Error("Invalid value for 'skip': '" + parameters.skip + "'");
                    }
                    return {
                        Mapper: function (line) {
                            var values = csv.parse(line)[0];
                            return lazy(headers).zip(values).toObject();
                        },
                        Skip: skip
                    };
                }
                else {
                    return {
                        Mapper: function (line) {
                            try {
                                return JSON.parse(line);
                            }
                            catch (err) {
                                throw 'Failed to parse line: ' + line;
                            }
                        },
                        Skip: 0
                    };
                }
            };
            FileDataSource.prototype.Get = function (value, parameters, context) {
                var fullPath = path.isAbsolute(value) ? value : path.join(context.BaseDirectory, value);
                if (!fs.existsSync(fullPath)) {
                    throw new Error('File not found: ' + fullPath);
                }
                else {
                    var lineHandler = this.GetLineMapper(fullPath, parameters);
                    var seq = lazy.readFile(fullPath, 'utf8').split(/\r?\n/).map(lineHandler.Mapper);
                    if (lineHandler.Skip)
                        seq = seq.rest(lineHandler.Skip);
                    return seq;
                }
            };
            return FileDataSource;
        })();
        DataSources.FileDataSource = FileDataSource;
        var VariableDataSource = (function () {
            function VariableDataSource() {
            }
            VariableDataSource.prototype.Get = function (value, parameters, context) {
                if (!context.Data || !context.Data[value]) {
                    console.log(context);
                    throw new Error("Target variable not found in context: '" + value + "'");
                }
                return lazy(context.Data[value]);
            };
            return VariableDataSource;
        })();
        DataSources.VariableDataSource = VariableDataSource;
    })(DataSources = Jsoql.DataSources || (Jsoql.DataSources = {}));
})(Jsoql || (Jsoql = {}));
///<reference path="utilities.ts" />
///<reference path="typings/node/node.d.ts"/>
///<reference path="typings/lazyjs/lazyjs.d.ts"/>
///<reference path="typings/q/Q.d.ts"/>
///<reference path="datasource.ts" />
var Jsoql;
(function (Jsoql) {
    var Query;
    (function (Query) {
        var lazy = require('lazy.js');
        var Q = require('q');
        var clone = require('clone');
        var operators = {
            '=': function (args) { return args[0] == args[1]; },
            '!=': function (args) { return args[0] !== args[1]; },
            '>': function (args) { return args[0] > args[1]; },
            '>=': function (args) { return args[0] >= args[1]; },
            '<': function (args) { return args[0] < args[1]; },
            '<=': function (args) { return args[0] <= args[1]; },
            'and': function (args) { return args[0] && args[1]; },
            'or': function (args) { return args[0] || args[1]; }
        };
        var aggregateFunctions = {
            'count': function (items) { return items.length; },
            'max': function (items) { return lazy(items).max(); },
            'min': function (items) { return lazy(items).min(); },
            'sum': function (items) { return lazy(items).sum(); },
            'avg': function (items) {
                var count = items.length;
                if (count)
                    return lazy(items).sum() / count;
                else
                    return undefined;
            }
        };
        var JsoqlQuery = (function () {
            function JsoqlQuery(stmt, queryContext) {
                this.stmt = stmt;
                queryContext = queryContext || {};
                this.queryContext = {
                    BaseDirectory: queryContext.BaseDirectory || process.cwd(),
                    Data: queryContext.Data || {}
                };
                //this.queryContext = extend(queryContext,
                //    {
                //        BaseDirectory: process.cwd(),
                //        Data: {}
                //    });
            }
            JsoqlQuery.prototype.DoOperation = function (operator, args) {
                var func = operators[operator.toLowerCase()];
                if (!func)
                    throw 'Unrecognized operator: ' + name;
                return func(args);
            };
            JsoqlQuery.prototype.DoAggregateFunction = function (name, items) {
                var func = aggregateFunctions[name.toLowerCase()];
                if (!func)
                    throw 'Unrecognized function: ' + name;
                return func(items);
            };
            JsoqlQuery.prototype.EvaluateAliased = function (expression, target, alias) {
                var _this = this;
                if (expression.Operator) {
                    var args = expression.Args.map(function (arg) { return _this.Evaluate(arg, target); });
                    return [{ Alias: '', Value: this.DoOperation(expression.Operator, args) }];
                }
                else if (expression.Property == '*') {
                    if (!target)
                        return [];
                    else
                        return Object.keys(target).map(function (key) {
                            return {
                                Alias: key,
                                Value: target[key]
                            };
                        });
                }
                else if (expression.Property) {
                    var aliasPrefix = alias ? alias + '.' : '';
                    var propTarget, propAlias;
                    if (expression.Index != undefined) {
                        //TODO: Check index is integer and target property is array
                        propTarget = target[expression.Property][expression.Index];
                        propAlias = aliasPrefix + expression.Property + '[' + expression.Index + ']';
                    }
                    else {
                        propTarget = target[expression.Property];
                        propAlias = aliasPrefix + expression.Property;
                    }
                    if (expression.Child)
                        return this.EvaluateAliased(expression.Child, propTarget, propAlias);
                    else
                        return [{ Alias: propAlias, Value: propTarget }];
                }
                else if (expression.Quoted)
                    return [{ Alias: expression.Quoted, Value: expression.Quoted }];
                else
                    return [{ Alias: '', Value: expression }];
            };
            JsoqlQuery.prototype.Evaluate = function (expression, target) {
                var _this = this;
                if (expression.Operator) {
                    var args = expression.Args.map(function (arg) { return _this.Evaluate(arg, target); });
                    return this.DoOperation(expression.Operator, args);
                }
                else if (expression.Property) {
                    var propTarget;
                    if (expression.Index != undefined) {
                        //TODO: Check index is integer and target property is array
                        propTarget = target[expression.Property][expression.Index];
                    }
                    else
                        propTarget = target[expression.Property];
                    if (expression.Child)
                        return this.Evaluate(expression.Child, propTarget);
                    else
                        return propTarget;
                }
                else if (expression.Quoted)
                    return expression.Quoted;
                else
                    return expression;
            };
            JsoqlQuery.prototype.Key = function (expression) {
                if (expression.Property) {
                    var propKey;
                    if (expression.Index != undefined) {
                        propKey = expression.Property + '[' + expression.Index + ']';
                    }
                    else
                        propKey = expression.Property;
                    if (expression.Child)
                        return propKey + '.' + this.Key(expression.Child);
                    else
                        return propKey;
                }
                else if (expression.Call) {
                    return expression.Call;
                }
                else
                    return '';
            };
            JsoqlQuery.prototype.EvaluateGroup = function (expression, group) {
                var _this = this;
                if (JsoqlQuery.IsAggregate(expression)) {
                    var items = expression.Arg ? group.Items.map(function (item) { return _this.Evaluate(expression.Arg, item); }) : group.Items;
                    return this.DoAggregateFunction(expression.Call, items);
                }
                else if (expression.Property) {
                    var key = this.Key(expression);
                    return group.Key[key];
                }
                /*if (expression.Operator) {
                    var args = expression.Args.map(arg => this.Evaluate(arg, target)[1]);
                    return ['', this.DoOperation(expression.Operator, args)];
                }
                else if (expression.Property) {
                    if (expression.Child) return this.Evaluate(expression.Child, target[expression.Property]);
                    else return [expression.Property, target[expression.Property]];
                }
                else if (expression.Quoted) return ['', expression.Quoted];
                else return ['', expression];*/
            };
            JsoqlQuery.prototype.GetSequence = function (target) {
                var fromTargetRegex = new RegExp('^([A-Za-z]+)://([^?]+)(?:\\?(.+))?$', 'i');
                var match = target.match(fromTargetRegex);
                if (!match)
                    throw new Error("Invalid target for from clause: '" + target + "'");
                var scheme = match[1].toLowerCase();
                var parameters = match[3] ? Jsoql.QueryString.Parse(match[3]) : {};
                var dataSource = JsoqlQuery.dataSources[scheme];
                if (!dataSource)
                    throw new Error("Invalid scheme for from clause target: '" + scheme + "'");
                return dataSource.Get(match[2], parameters, this.queryContext);
            };
            JsoqlQuery.prototype.From = function (fromClause) {
                var _this = this;
                var targets = this.CollectFromTargets(fromClause);
                var seq = this.GetSequence(targets[0].Target);
                if (targets.length > 1) {
                    var aliases = lazy(targets).map(function (t) { return t.Alias; });
                    //Aliases are mandatory if multiple targets are used
                    if (lazy(aliases).some(function (a) { return !a; })) {
                        throw 'Each table must have an alias if more than one table is specified';
                    }
                    if (aliases.uniq().size() < targets.length) {
                        throw 'Table aliases must be unique';
                    }
                    //Map each item to a property with the alias of its source table
                    seq = seq.map(function (item) {
                        var mapped = {};
                        mapped[targets[0].Alias] = item;
                        return mapped;
                    });
                    //Join each subsequent table
                    lazy(targets).slice(1).each(function (target) {
                        //Get sequence of items from right of join
                        var rightItems = _this.GetSequence(target.Target);
                        //For each item on left of join, find 0 to many matching items from the right side, using the ON expression
                        seq = seq.map(function (li) {
                            return rightItems.map(function (ri) {
                                //Create prospective merged item containing left and right side items
                                var merged = clone(li);
                                merged[target.Alias] = ri;
                                //Return non-null value to indicate match
                                if (_this.Evaluate(target.Condition, merged))
                                    return merged;
                                else
                                    return null;
                            }).compact(); //Throw away null (non-matching) values
                        }).flatten(); //Flatten the sequence of sequences
                    });
                }
                else {
                }
                return seq;
            };
            JsoqlQuery.prototype.CollectFromTargets = function (fromClauseNode) {
                //Join
                if (fromClauseNode.Left) {
                    return this.CollectFromTargets(fromClauseNode.Left).concat(this.CollectFromTargets(fromClauseNode.Right).map(function (n) {
                        n.Condition = fromClauseNode.Expression;
                        return n;
                    }));
                }
                else if (fromClauseNode.Target) {
                    //Quoted
                    if (fromClauseNode.Target.Quoted) {
                        return [{ Target: fromClauseNode.Target.Quoted, Alias: fromClauseNode.Alias }];
                    }
                    else
                        return [{ Target: fromClauseNode.Target, Alias: fromClauseNode.Alias }];
                }
                else {
                    //Quoted
                    if (fromClauseNode.Quoted) {
                        return [{ Target: fromClauseNode.Quoted, Alias: null }];
                    }
                    else {
                        return [{ Target: fromClauseNode, Alias: null }];
                    }
                }
            };
            JsoqlQuery.prototype.Execute = function () {
                var _this = this;
                //From
                var seq = this.From(this.stmt.FromWhere.From);
                //Where
                if (this.stmt.FromWhere.Where) {
                    seq = seq.filter(function (item) {
                        return _this.Evaluate(_this.stmt.FromWhere.Where, item);
                    });
                }
                //Grouping
                //Explicitly
                if (this.stmt.GroupBy) {
                    return this.GroupBy(seq, this.stmt.GroupBy).then(function (groups) {
                        (_this.stmt.OrderBy || []).forEach(function (orderByExp) {
                            groups = groups.sortBy(function (group) { return _this.EvaluateGroup(orderByExp.Expression, group); }, !orderByExp.Asc);
                        });
                        return groups.map(function (group) { return lazy(_this.stmt.Select.SelectList).map(function (selectable) { return [
                            selectable.Alias || _this.Key(selectable.Expression),
                            _this.EvaluateGroup(selectable.Expression, group)
                        ]; }).toObject(); }).first(_this.stmt.Select.Limit || Number.MAX_VALUE).toArray();
                    });
                }
                else if (lazy(this.stmt.Select.SelectList).some(function (selectable) { return JsoqlQuery.IsAggregate(selectable.Expression); })) {
                    return JsoqlQuery.SequenceToArray(seq).then(function (items) {
                        var group = {
                            Key: null,
                            Items: items
                        };
                        return [
                            lazy(_this.stmt.Select.SelectList).map(function (selectable) { return [
                                selectable.Alias || _this.Key(selectable.Expression),
                                _this.EvaluateGroup(selectable.Expression, group)
                            ]; }).toObject()
                        ];
                    });
                }
                else {
                    (this.stmt.OrderBy || []).forEach(function (orderByExp) {
                        seq = seq.sortBy(function (item) { return _this.Evaluate(orderByExp.Expression, item); }, !orderByExp.Asc);
                    });
                    //Select
                    seq = seq.first(this.stmt.Select.Limit || Number.MAX_VALUE).map(function (item) {
                        return lazy(_this.stmt.Select.SelectList).map(function (selectable) { return _this.EvaluateAliased(selectable.Expression, item).map(function (aliasValue) {
                            return {
                                Alias: selectable.Alias || aliasValue.Alias,
                                Value: aliasValue.Value
                            };
                        }); }).flatten().map(function (aliasValue) { return [aliasValue.Alias, aliasValue.Value]; }).toObject();
                    });
                    return JsoqlQuery.SequenceToArray(seq);
                }
            };
            /*Group(): Q.Promise<JqlQuery> {
                return (<any>this.sequence
                    .toArray())
                    .then(arr => {
                        var group: Group = {
                            Items: arr
                        };
                        return new JqlQuery(lazy([group]));
                    });
            }*/
            JsoqlQuery.prototype.GroupBy = function (seq, expressions) {
                var _this = this;
                var groupKey = function (item) {
                    var object = lazy(expressions).map(function (exp) { return [_this.Key(exp), _this.Evaluate(exp, item)]; }).toObject();
                    return JSON.stringify(object);
                };
                return JsoqlQuery.SequenceToArray(seq).then(function (items) {
                    var grouped = lazy(items).groupBy(groupKey);
                    var lazyGroups = grouped.toArray();
                    var groups = lazyGroups.map(function (lg) {
                        return {
                            Key: JSON.parse(lg[0]),
                            Items: lg[1]
                        };
                    });
                    return lazy(groups);
                });
            };
            JsoqlQuery.IsAggregate = function (expression) {
                return !!expression && !!expression.Call && !!aggregateFunctions[expression.Call.toLowerCase()];
            };
            JsoqlQuery.SequenceToArray = function (seq) {
                var arrayPromise = seq.toArray();
                if (Jsoql.Utilities.IsArray(arrayPromise))
                    return Q(arrayPromise);
                else {
                    var deferred = Q.defer();
                    arrayPromise.then(function (result) { return deferred.resolve(result); }, function (error) { return deferred.reject(error); });
                    return deferred.promise;
                }
            };
            JsoqlQuery.dataSources = {
                "var": new Jsoql.DataSources.VariableDataSource(),
                "file": new Jsoql.DataSources.FileDataSource()
            };
            return JsoqlQuery;
        })();
        Query.JsoqlQuery = JsoqlQuery;
    })(Query = Jsoql.Query || (Jsoql.Query = {}));
})(Jsoql || (Jsoql = {}));
///<reference path="Scripts/parse.ts" />
///<reference path="Scripts/query.ts" />
var Jsoql;
(function (Jsoql) {
    var Q = require('Q');
    function ExecuteQuery(jsoql, context) {
        var statement;
        statement = Jsoql.Parse.Parse(jsoql);
        var query = new Jsoql.Query.JsoqlQuery(statement, context);
        return query.Execute().then(function (results) {
            return { Results: results };
        });
    }
    Jsoql.ExecuteQuery = ExecuteQuery;
})(Jsoql || (Jsoql = {}));
module.exports = Jsoql;
var _this = this;
var lazy = require('lazy.js');
var factory = lazy.createWrapper(function (eventSource) {
    var sequence = _this;
    eventSource.handleEvent(function (data) {
        sequence.emit(data);
    });
});
var Jsoql;
(function (Jsoql) {
    var Lazy;
    (function (Lazy) {
        Lazy.lazyJsonFile = factory;
    })(Lazy = Jsoql.Lazy || (Jsoql.Lazy = {}));
})(Jsoql || (Jsoql = {}));
///<reference path="typings/node/node.d.ts"/>
var Jsoql;
(function (Jsoql) {
    var QueryString;
    (function (QueryString) {
        var lazy = require('lazy.js');
        function Parse(value) {
            if (!value)
                return {};
            var pairs = value.split('&');
            return lazy(pairs).map(function (pair) { return pair.split('='); }).toObject();
        }
        QueryString.Parse = Parse;
    })(QueryString = Jsoql.QueryString || (Jsoql.QueryString = {}));
})(Jsoql || (Jsoql = {}));
//SELECT Thing.*.Something

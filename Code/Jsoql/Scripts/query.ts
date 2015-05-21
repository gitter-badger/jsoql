﻿import lazy = require('lazy.js')
import Q = require('q')
import ds = require('./datasource')
import parse = require('./parse')
import m = require('./models')
import qstring = require('./query-string')
import util = require('./utilities')
import evl = require('./evaluate')
var clone = require('clone')

export class JsoqlQuery {

    private queryContext: m.QueryContext;
    private evaluator: evl.Evaluator;

    constructor(private stmt: parse.Statement,
        private dataSources : ds.DataSources,
        queryContext?: m.QueryContext) {

        queryContext = queryContext || {};

        this.queryContext = {
            BaseDirectory: queryContext.BaseDirectory || process.cwd(),
            Data: queryContext.Data || {}
        };

        this.evaluator = new evl.Evaluator(dataSources); 
    }

    private GetSequence(target: any): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any> {

        var fromTargetRegex = new RegExp('^([A-Za-z]+)://([^?]+)(?:\\?(.+))?$', 'i');

        //Property
        if (typeof target != 'string') {
            return this.dataSources['var'].Get(target, {}, this.queryContext);
        }
        else {
            var match = target.match(fromTargetRegex);

            if (!match) {
                return this.dataSources['var'].Get(target, {}, this.queryContext);
            }
            else {
                var scheme = match[1].toLowerCase();
                var parameters = match[3] ? qstring.Parse(match[3]) : {};
                var dataSource = this.dataSources[scheme];
                if (!dataSource) throw new Error("Invalid scheme for from clause target: '" + scheme + "'");

                return dataSource.Get(match[2], parameters, this.queryContext);
            } 
        }
        
    }

    private From(fromClause: any): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any> {

        var targets = this.CollectFromTargets(fromClause);

        var seq = this.GetSequence(targets[0].Target);

        if (targets.length > 1) {
            var aliases = lazy(targets).map(t => t.Alias);

            //Aliases are mandatory if multiple targets are used
            if (lazy(aliases).some(a => !a)) {
                throw 'Each table must have an alias if more than one table is specified';
            }
            if (aliases.uniq().size() < targets.length) {
                throw 'Table aliases must be unique';
            }

            //Map each item to a property with the alias of its source table
            seq = seq.map(item => {
                var mapped = {};
                mapped[targets[0].Alias] = item;
                return mapped;
            });

            //Join/over each subsequent table
            lazy(targets).slice(1).each(target => {

                if (target.Condition) seq = this.Join(seq, this.GetSequence(target.Target), target.Alias, target.Condition);
                else if (target.Over) seq = this.Over(seq, target.Target, target.Alias);
                else throw new Error("Unsupported FROM clause");
               
            });
        }
        else {
            //No need to do any mapping
        }

        return seq;
    }

    private Over(left: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>,
        childExpression : any,
        childAlias: string): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any> {

        return left.map(li => {
            var children = this.evaluator.Evaluate(childExpression, li) || [];
            return children.map(child => {
                var merged = clone(li);
                merged[childAlias] = child;
                return merged;
            });
        })
        .flatten();

    }

    private Join(left: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>,
        right: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>,
        rightAlias: string,
        condition : any): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any> {

        //For each item on left of join, find 0 to many matching items from the right side, using the ON expression
        return left.map(li => {
            return right.map(ri => {
                //Create prospective merged item containing left and right side items
                var merged = clone(li);
                merged[rightAlias] = ri;

                //Return non-null value to indicate match
                if (this.evaluator.Evaluate(condition, merged)) return merged;
                else return null;
            })
            .compact() //Throw away null (non-matching) values
        })
        .flatten(); //Flatten the sequence of sequences

    }

    private CollectFromTargets(fromClauseNode: any): { Target: string; Alias: string; Condition?: any; Over?: boolean; }[] {

        //Join
        if (fromClauseNode.Expression) {
            return this.CollectFromTargets(fromClauseNode.Left)
                .concat(this.CollectFromTargets(fromClauseNode.Right)
                .map(n => {
                        n.Condition = fromClauseNode.Expression;
                        return n;
                    })
                );
        }
        //Over
        else if (fromClauseNode.Over) {
            return this.CollectFromTargets(fromClauseNode.Left)
                .concat([{ Target: fromClauseNode.Over, Alias: fromClauseNode.Alias, Over: true }]);       
        }
        //Aliased
        else if (fromClauseNode.Target) {
            //Quoted
            if (fromClauseNode.Target.Quoted) {
                return [{ Target: fromClauseNode.Target.Quoted, Alias: fromClauseNode.Alias }];
            }
            //Unquoted
            else return [{ Target: fromClauseNode.Target, Alias: fromClauseNode.Alias }];
        }
        //Un-aliased
        else {
            //Quoted
            if (fromClauseNode.Quoted) {
                return [{ Target: fromClauseNode.Quoted, Alias: null }];
            }
            //Un-quoted
            else {
                return [{ Target: fromClauseNode, Alias: null }];
            }
        }

    }

    private Where(seq: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>, whereClause : any): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>{
        return seq.filter(item => {
            return this.evaluator.Evaluate(this.stmt.FromWhere.Where, item);
        })
    }

    private SelectGrouped(groups: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>,
        having: any): LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>{

        if (having) {
            groups = groups.filter(group => this.evaluator.EvaluateGroup(having, group));
        }


        (this.stmt.OrderBy || []).forEach(orderByExp => {
            groups = groups.sortBy(group => this.evaluator.EvaluateGroup(orderByExp.Expression, group), !orderByExp.Asc);
        });

        return groups.map(group =>
            lazy(this.stmt.Select.SelectList)
                .map(selectable => [
                selectable.Alias || evl.Evaluator.Key(selectable.Expression),
                this.evaluator.EvaluateGroup(selectable.Expression, group)
            ])
                .toObject()
            )
            .first(this.stmt.Select.Limit || Number.MAX_VALUE);
    }
    private SelectMonoGroup(items : any[]): any[] {
        
        var group: m.Group = {
            Key: null,
            Items: items
        };

        return [
            lazy(this.stmt.Select.SelectList)
                .map(selectable => [
                selectable.Alias || evl.Evaluator.Key(selectable.Expression),
                this.evaluator.EvaluateGroup(selectable.Expression, group)
            ])
            .toObject()
        ];
    }

    private SelectUngrouped(seq: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>): LazyJS.Sequence<any>|LazyJS.AsyncSequence <any>{
        (this.stmt.OrderBy || []).forEach(orderByExp => {
            seq = seq.sortBy(item => this.evaluator.Evaluate(orderByExp.Expression, item), !orderByExp.Asc);
        });

        //Select
        return seq
            .first(this.stmt.Select.Limit || Number.MAX_VALUE)
            .map(item => {
            return lazy(this.stmt.Select.SelectList)
                .map(selectable =>
                    this.evaluator.EvaluateAliased(selectable.Expression, item)
                        .map(aliasValue => {
                        return {
                            Alias: selectable.Alias || aliasValue.Alias,
                            Value: aliasValue.Value
                        };
                    })
                )
                .flatten()
                .map((aliasValue: any) => [aliasValue.Alias, aliasValue.Value])
                .toObject();
        });
    }


    ExecuteSync(): any[]{
        //From
        var seq = this.From(this.stmt.FromWhere.From);

        //Where
        if (this.stmt.FromWhere.Where) seq = this.Where(seq, this.stmt.FromWhere.Where);

        //Grouping
        //Explicitly
        if (this.stmt.GroupBy) {
            seq = this.GroupBySync(seq, this.stmt.GroupBy.Groupings)
            seq = this.SelectGrouped(seq, this.stmt.GroupBy.Having);
            return JsoqlQuery.SequenceToArraySync(seq);
        }
        //Implicitly
        else if (lazy(this.stmt.Select.SelectList).some(selectable => evl.Evaluator.IsAggregate(selectable.Expression))) {

            var items = JsoqlQuery.SequenceToArraySync(seq);
            return this.SelectMonoGroup(items);
        }
        //No grouping
        else {
            return JsoqlQuery.SequenceToArraySync(this.SelectUngrouped(seq));
        }
    }

    Execute(): Q.Promise<any[]> {
        
        //From
        var seq = this.From(this.stmt.FromWhere.From);

        //Where
        if (this.stmt.FromWhere.Where) seq = this.Where(seq, this.stmt.FromWhere.Where);

        //Grouping
        //Explicitly
        if (this.stmt.GroupBy) {
            return this.GroupBy(seq, this.stmt.GroupBy.Groupings)
                .then(groups => this.SelectGrouped(groups, this.stmt.GroupBy.Having))
                .then(resultSeq => resultSeq.toArray());
        }
        //Implicitly
        else if (lazy(this.stmt.Select.SelectList).some(selectable => evl.Evaluator.IsAggregate(selectable.Expression))) {

            return JsoqlQuery.SequenceToArray(seq)
                .then(items => this.SelectMonoGroup(items));
        }
        //No grouping
        else {
            return JsoqlQuery.SequenceToArray(this.SelectUngrouped(seq));
        }
    }

    private GroupBySync(seq: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>, expressions : any[]): LazyJS.Sequence<m.Group> {
        var groupKey = (item: any) => {
            var object = lazy(expressions)
                .map(exp => [evl.Evaluator.Key(exp), this.evaluator.Evaluate(exp, item)])
                .toObject();

            return JSON.stringify(object);
        };

        var items = JsoqlQuery.SequenceToArraySync(seq);
          
        var grouped = lazy(items).groupBy(groupKey);
        var lazyGroups = grouped.toArray();
        var groups: m.Group[] = lazyGroups.map(lg => {
            return {
                Key: JSON.parse(lg[0]),
                Items: lg[1]
            };
        });

        return lazy(groups);
    }

    private GroupBy(seq: LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>, expressions: any[]): Q.Promise<LazyJS.Sequence<m.Group>> {
        var groupKey = (item: any) => {
            var object = lazy(expressions)
                .map(exp => [evl.Evaluator.Key(exp), this.evaluator.Evaluate(exp, item)])
                .toObject();

            return JSON.stringify(object);
        };

        return JsoqlQuery.SequenceToArray(seq)
            .then(items => {
            var grouped = lazy(items).groupBy(groupKey);
            var lazyGroups = grouped.toArray();
            var groups: m.Group[] = lazyGroups.map(lg => {
                return {
                    Key: JSON.parse(lg[0]),
                    Items: lg[1]
                };
            });

            return lazy(groups);
        });
    }

    private static SequenceToArraySync<T>(seq: LazyJS.Sequence<T>|LazyJS.AsyncSequence<any>): T[] {
        var arrayPromise: any = seq.toArray();

        if (util.IsArray(arrayPromise)) return arrayPromise;
        else {
            throw new Error('Sequence is asynchronous');
        }
    }

    private static SequenceToArray<T>(seq: LazyJS.Sequence<T>|LazyJS.AsyncSequence<any>): Q.Promise<T[]> {
        var arrayPromise: any = seq.toArray();

        if (util.IsArray(arrayPromise)) return Q(arrayPromise);
        else {
            var deferred = Q.defer<T[]>();

            arrayPromise.then(
                result => deferred.resolve(result),
                error => deferred.reject(error)
            );

            return deferred.promise;
        }
    }
}
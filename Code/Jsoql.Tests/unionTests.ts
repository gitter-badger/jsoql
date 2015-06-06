﻿///<reference path="Scripts/typings/jsoql/jsoql.d.ts"/>

import assert = require('assert');
import testBase = require('./testBase');


export function Union() {
    var context: JsoqlQueryContext = {
        Data: {
            people1: [
                { Name: 'Dave', FavouriteFoods: ['Chips', 'Doughnuts'] },
                { Name: 'Jim', FavouriteFoods: ['Baked beans', 'Broccoli'] }
            ],
            people2: [
                { Name: 'Mary', FavouriteFoods: ['Breadsticks'] },
                { Name: 'Sue', FavouriteFoods: ['Carrots', 'Tiramisu','Cheese'] }
            ]
        }
    };

    var query = "SELECT * FROM 'var://people1' UNION SELECT * FROM 'var://people2'";
    var expected = context.Data['people1'].concat(context.Data['people2']);

    return testBase.ExecuteAndAssertDeepEqual(query, context, expected);
}

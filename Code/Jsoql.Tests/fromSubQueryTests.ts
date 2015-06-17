﻿///<reference path="Scripts/typings/jsoql/jsoql.d.ts"/>

import assert = require('assert');
import testBase = require('./testBase');


export function FromSubQuery() {
    var data = [
        { Name: 'Dave', FavouriteFoods: ['Chips', 'Doughnuts'] },
        { Name: 'Jim', FavouriteFoods: ['Baked beans', 'Broccoli'] }
    ];
    var query = "SELECT Name FROM (SELECT * FROM 'var://Test')";
    var expected = [
        { Name: 'Dave' },
        { Name: 'Jim'}
    ];
    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}

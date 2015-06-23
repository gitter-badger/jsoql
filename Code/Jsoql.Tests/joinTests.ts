﻿import jsoql = require('jsoql')
import assert = require('assert');
import testBase = require('./testBase');


export function ImplicitInnerJoin() {
    
    var dataA = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'B', CustomerId: 2 }
    ];

    var dataB = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
    ];

    var expected = [
        { CustomerId: 1, Name: 'Tim', Order: 'A' },
        { CustomerId: 1, Name: 'Tim', Order: 'B' },
        { CustomerId: 2, Name: 'Bob', Order: 'B' }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": dataA,
            "Customers": dataB
        }
    };
    var query = "SELECT c.CustomerId AS CustomerId, c.Name AS Name, o.Order AS Order FROM 'var://Orders' AS o JOIN 'var://Customers' AS c ON o.CustomerId = c.CustomerId";
    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}


export function ExplicitInnerJoin() {

    var dataA = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'B', CustomerId: 2 }
    ];

    var dataB = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
    ];

    var expected = [
        { CustomerId: 1, Name: 'Tim', Order: 'A' },
        { CustomerId: 1, Name: 'Tim', Order: 'B' },
        { CustomerId: 2, Name: 'Bob', Order: 'B' }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": dataA,
            "Customers": dataB
        }
    };
    var query = 
        "SELECT c.CustomerId AS CustomerId, c.Name AS Name, o.Order AS Order \
        FROM 'var://Orders' AS o \
        INNER JOIN 'var://Customers' AS c ON o.CustomerId = c.CustomerId";

    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}

export function JoinHttpDatasources() {

    var data = [1, 2, 3, 4, 5, 6, 7, 8].map(i => {
        return { Id: i };
    });
    var query = "SELECT a.Id AS A, b.Id AS B FROM 'http://localhost:8000' AS a JOIN 'http://localhost:8000' AS b ON a.Id = b.Id + 1";
    var expected = [1, 2, 3, 4, 5, 6, 7].map(i => {
        return { A: i+1, B: i };
    });

    return testBase.ExecuteAndAssertWithServer(query, data, 8000, results => {
        assert.deepEqual(results, expected);
    });
}


function _LeftJoin(joinTokens : string) {

    var customers = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
        { CustomerId: 3, Name: 'Genghis' },
    ];

    var orders = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'C', CustomerId: 2 },
        { Order: 'D', CustomerId: 4 }
    ];

   
    var expected = [
        { CustomerId: 1, Name: 'Tim', Order: 'A' },
        { CustomerId: 1, Name: 'Tim', Order: 'B' },
        { CustomerId: 2, Name: 'Bob', Order: 'C' },
        { CustomerId: 3, Name: 'Genghis', Order: null },
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": orders,
            "Customers": customers
        }
    };
    var query =
        `SELECT c.CustomerId AS CustomerId, c.Name AS Name, o.Order AS Order \
        FROM 'var://Customers' AS c\
        ${joinTokens} 'var://Orders' AS o ON c.CustomerId = o.CustomerId`;

    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}

export function LeftJoin() {
    return _LeftJoin("LEFT JOIN");
}

export function LeftOuterJoin() {
    return _LeftJoin("LEFT OUTER JOIN");
}

function _RightJoin(joinTokens : string) {

    var customers = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
        { CustomerId: 3, Name: 'Genghis' },
    ];

    var orders = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'C', CustomerId: 2 },
        { Order: 'D', CustomerId: 4 }
    ];


    var expected = [
        { Order: 'A', Customer: 'Tim' },
        { Order: 'B', Customer: 'Tim'},
        { Order: 'C', Customer: 'Bob'},
        { Order: 'D', Customer: null }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": orders,
            "Customers": customers
        }
    };
    var query =
        `SELECT o.Order AS Order, c.Name AS Customer \
        FROM 'var://Customers' AS c\
        ${joinTokens} 'var://Orders' AS o ON c.CustomerId = o.CustomerId`;

    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}

export function RightJoin() {
    return _RightJoin("RIGHT JOIN");
}

export function RightOuterJoin() {
    return _RightJoin("RIGHT OUTER JOIN");
}

export function TwoLeftJoins() {
    var customers = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
        { CustomerId: 3, Name: 'Genghis' },
    ];

    var orders = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'C', CustomerId: 2 },
        { Order: 'D', CustomerId: 4 }
    ];

    var orderItems = [
        { Order: 'A', Item: 'Cuddly toy' },
        { Order: 'A', Item: 'Microwave oven'},
        { Order: 'B', Item: 'Compact disc player'},
        { Order: 'D', Item: 'Package holiday' }
    ];

    var query =
        "SELECT c.CustomerId AS CustomerId, c.Name AS Name, o.Order AS Order, oi.Item AS Item \
        FROM 'var://Customers' AS c\
        LEFT JOIN 'var://Orders' AS o ON c.CustomerId = o.CustomerId \
        LEFT JOIN 'var://OrderItems' AS oi ON o.Order = oi.Order";

    var expected = [
        { CustomerId: 1, Name: 'Tim', Order: 'A', Item: 'Cuddly toy' },
        { CustomerId: 1, Name: 'Tim', Order: 'A', Item: 'Microwave oven' },
        { CustomerId: 1, Name: 'Tim', Order: 'B', Item: 'Compact disc player' },
        { CustomerId: 2, Name: 'Bob', Order: 'C', Item: null},
        { CustomerId: 3, Name: 'Genghis', Order: null, Item: null},
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": orders,
            "Customers": customers,
            "OrderItems": orderItems
        }
    };
  

    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}


export function LeftThenRightJoin() {
    var customers = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
        { CustomerId: 3, Name: 'Genghis' },
    ];

    var orders = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'C', CustomerId: 2 },
        { Order: 'D', CustomerId: 4 }
    ];

    var orderItems = [
        { Order: 'A', Item: 'Cuddly toy' },
        { Order: 'A', Item: 'Microwave oven' },
        { Order: 'B', Item: 'Compact disc player' },
        { Order: 'D', Item: 'Package holiday' },
        { Order: 'E', Item: 'Family car' }
    ];

    var query =
        "SELECT c.CustomerId AS CustomerId, c.Name AS Name, o.Order AS Order, oi.Item AS Item \
        FROM 'var://Orders' AS o\
        LEFT JOIN 'var://Customers' AS c ON c.CustomerId = o.CustomerId \
        RIGHT JOIN 'var://OrderItems' AS oi ON o.Order = oi.Order";

    var expected = [
        { Order: 'A', Item: 'Cuddly toy', CustomerId: 1, Name: 'Tim' },
        { Order: 'A', Item: 'Microwave oven', CustomerId: 1, Name: 'Tim' },
        { Order: 'B', Item: 'Compact disc player', CustomerId: 2, Name: 'Bob'},
        { Order: 'D', Item: 'Package holiday', CustomerId: null, Name: null},
        { Order: null, Item: 'Family car', CustomerId: null, Name: null }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": orders,
            "Customers": customers,
            "OrderItems": orderItems
        }
    };


    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);
}

export function FullOuterJoin() {

    var customers = [
        { CustomerId: 1, Name: 'Tim' },
        { CustomerId: 2, Name: 'Bob' },
        { CustomerId: 3, Name: 'Genghis' },
    ];

    var orders = [
        { Order: 'A', CustomerId: 1 },
        { Order: 'B', CustomerId: 1 },
        { Order: 'C', CustomerId: 2 },
        { Order: 'D', CustomerId: 4 }
    ];

    var query =
        "SELECT o.Order AS Order, c.Name AS Customer \
        FROM 'var://Customers' AS c\
        FULL OUTER JOIN 'var://Orders' AS o ON c.CustomerId = o.CustomerId";

    var expected = [
        { Customer: 'Tim', Order: 'A' },
        { Customer: 'Tim' ,Order: 'B' },
        { Customer: 'Bob', Order: 'C' },
        { Customer: 'Genghis', Order: null },
        { Customer: null, Order: 'D' }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Orders": orders,
            "Customers": customers
        }
    };
    
    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);

}


export function CrossJoin() {

    var colours = [
        { Colour: 'Blue'},
        { Colour: 'Green' },
        { Colour: 'Red' }
    ];

    var shapes = [
        { Shape: 'Square' },
        { Shape: 'Triangle' },
        { Shape: 'Circle' }
    ];

    var query =
        "SELECT c.Colour AS Colour, s.Shape AS shape \
        FROM 'var://Colours' AS c\
        CROSS JOIN 'var://Shapes' AS s";

    var expected = [
        { Colour: 'Blue',Shape: 'Square' },
        { Colour: 'Blue',Shape: 'Triangle' },
        { Colour: 'Blue',Shape: 'Circle' },
        { Colour: 'Green',Shape: 'Square' },
        { Colour: 'Green', Shape: 'Triangle' },
        { Colour: 'Green', Shape: 'Circle' },
        { Colour: 'Red',Shape: 'Square' },
        { Colour: 'Red',Shape: 'Triangle' },
        { Colour: 'Red',Shape: 'Circle' }
    ];

    var data: jsoql.JsoqlQueryContext = {
        Data: {
            "Colours":colours,
            "Shapes": shapes
        }
    };

    return testBase.ExecuteAndAssertDeepEqual(query, data, expected);

}
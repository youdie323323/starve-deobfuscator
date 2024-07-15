import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { readFileSync, writeFileSync } from 'fs'
import { webcrack } from 'webcrack';
import { minify } from "terser";
import * as m from '@codemod/matchers';

// Starve client deobfuscator made by youdi3

(async function () {
    console.log("Read obfuscated build");

    const code = readFileSync("./input/obfuscated.js").toString();

    console.log("Running terser minify");

    const minified = await minify(code, {
        mangle: {
            keep_classnames: false,
            keep_fnames: false,
            module: true,
            properties: false,
            reserved: [],
            toplevel: true,
        },
    });

    console.log("Parse minified code");

    const ast = parser.parse(minified.code!);

    console.log("Running transformers");

    let stringConcealingCount = 0;
    let numberConcealingCount = 0;

    let objectNumberIndexCounter = 0;
    let objectNumbers = new Map<string, { prop: string; value: number }[]>();

    function cloneArrayMap<T, E, N extends Map<T, Array<E>>>(mapIn: N): N {
        let mapCloned: N = new (mapIn.constructor as { new(): N })();
        mapIn.forEach((products: Array<E>, key: T) => {
            mapCloned.set(key, products.slice(0));
        });
        return mapCloned;
    };
    
    let encodedChars: number[][] = [];
    let encodedCharsName = "";
    let alreadyPassed = false;
    let decodedStrings1: string[] = [];

    traverse(ast, {
        AssignmentExpression(path) {
            if (t.isArrayExpression(path.node.right)) {
                if (
                    !path.node.right.elements.some((e) => !t.isArrayExpression(e)) &&
                    path.node.right.elements.length > 20 && !alreadyPassed
                ) {
                    path.node.right.elements.forEach((e) => {
                        if (e && t.isArrayExpression(e) && !e.elements.some((e) => !t.isNumericLiteral(e))) {
                            let encodedChar: number[] = [];
                            e.elements.forEach((e2) => {
                                if (t.isNumericLiteral(e2)) {
                                    encodedChar.push(e2.value);
                                }
                            });
                            encodedChars.push(encodedChar);
                        }
                    });
                    if (t.isIdentifier(path.node.left)) {
                        encodedCharsName = path.node.left.name;
                    }
                    alreadyPassed = true;
                }
            }
        },
    });

    traverse(ast, {
        //for (let Δⵠ = 00; Δⵠ < Ⲇᐃ['\x6c\x65\x6e\147\x74\150']; Δⵠ++)
        //  Ⲇᐃ[Δⵠ] = ⵠⲆ['\x61\164\157\142'](ᐃΔΔ(Ⲇᐃ[Δⵠ]));
        ForStatement(path) {
            if (
                t.isBinaryExpression(path.node.test) &&
                path.node.test.right &&
                t.isMemberExpression(path.node.test.right) &&
                t.isIdentifier(path.node.test.right.object) &&
                path.node.test.right.object.name === encodedCharsName &&
                t.isExpressionStatement(path.node.body) &&
                t.isAssignmentExpression(path.node.body.expression) &&
                t.isMemberExpression(path.node.body.expression.left) &&
                t.isIdentifier(path.node.body.expression.left.object) &&
                path.node.body.expression.left.object.name == encodedCharsName &&
                t.isCallExpression(path.node.body.expression.right) &&
                path.node.body.expression.right.arguments.length == 1 &&
                t.isCallExpression(path.node.body.expression.right.arguments[0]) &&
                t.isIdentifier(path.node.body.expression.right.arguments[0].callee)
            ) {
                var binding = path.scope.getBinding(path.node.body.expression.right.arguments[0].callee.name);
                if (binding) {
                    path.remove();

                    //const Ⲇᐃᐃ = function(t) {
                    //    let n = "";
                    //    for (let r = 0; r < t.length; r++) n += window.String.fromCharCode(t[r] ^ ⲆΔ++ % 255);
                    //    return n
                    //};
                    if (
                        t.isVariableDeclarator(binding?.path.node) &&
                        t.isIdentifier(binding?.path.node.id) &&
                        t.isFunctionExpression(binding?.path.node.init) &&
                        binding?.path.node.init.body.body.length == 3 &&
                        t.isForStatement(binding?.path.node.init.body.body[1]) &&
                        t.isExpressionStatement(binding?.path.node.init.body.body[1].body) &&
                        t.isAssignmentExpression(binding?.path.node.init.body.body[1].body.expression) &&
                        t.isCallExpression(binding?.path.node.init.body.body[1].body.expression.right) &&
                        binding?.path.node.init.body.body[1].body.expression.right.arguments.length == 1 &&
                        t.isBinaryExpression(binding?.path.node.init.body.body[1].body.expression.right.arguments[0]) &&
                        t.isBinaryExpression(binding?.path.node.init.body.body[1].body.expression.right.arguments[0].right) &&
                        t.isUpdateExpression(binding?.path.node.init.body.body[1].body.expression.right.arguments[0].right.left) &&
                        t.isIdentifier(binding?.path.node.init.body.body[1].body.expression.right.arguments[0].right.left.argument)
                    ) {
                        let b2 = binding.scope.getBinding(binding?.path.node.init.body.body[1].body.expression.right.arguments[0].right.left.argument.name)?.path.node;
                        if (b2 && t.isNumericLiteral(b2["init"])) {
                            let key = b2["init"]["value"];
                            encodedChars.forEach((e) => {
                                let n = "";
                                for (let r = 0; r < e.length; r++) n += String.fromCharCode(e[r] ^ key++ % 255);
                                decodedStrings1.push(atob(n));
                            });
                        }
                    }
                }
            }
        },
    })

    let charsName = "";
    let decodedStrings2: string[] = [];
    let alreadyPassed2 = false;
    traverse(ast, {
        VariableDeclarator(path) {
            if (
                t.isIdentifier(path.node.id) &&
                t.isArrayExpression(path.node.init) &&
                path.node.init.elements.length > 20 &&
                !path.node.init.elements.some((e) => !t.isStringLiteral(e)) &&
                !alreadyPassed2
            ) {
                charsName = path.node.id.name;
                path.node.init.elements.forEach((e) => {
                    if (t.isStringLiteral(e)) {
                        decodedStrings2.push(e.value);
                    }
                });
                alreadyPassed2 = true;
            }
        },
    });

    const most: Map<string, number> = new Map<string, number>();
    let highest: { key: string; val: number } = {
        key: "",
        val: 0,
    };
    traverse(ast, {
        UpdateExpression(path) {
            if (path.node.operator == "++" && path.node.prefix == false && t.isIdentifier(path.node.argument) && t.isObjectProperty(path.parent)) {
                if (!most.get(path.node.argument.name)) {
                    most.set(path.node.argument.name, 1)
                }
                most.set(path.node.argument.name, (most.get(path.node.argument.name) as number) + 1)
            }
        },
    });
    most.forEach((v, k) => {
        if (highest.val < v) {
            highest.val = v;
            highest.key = k;
        }
    })

    traverse(ast, {
        ExpressionStatement(path) {
            if (
                t.isAssignmentExpression(path.node.expression) &&
                path.node.expression.operator == "=" &&
                t.isIdentifier(path.node.expression.left) &&
                path.node.expression.left.name === encodedCharsName
            ) {
                path.remove()
            }
        },
        MemberExpression(path) {
            if (t.isIdentifier(path.node.object) && (path.node.object.name == encodedCharsName || path.node.object.name == charsName)) {
                if (t.isNumericLiteral(path.node.property)) {
                    if (!(t.isAssignmentExpression(path.parent) && path.parent.left === path.node)) {
                        path.replaceWith(t.stringLiteral((path.node.object.name == encodedCharsName ? decodedStrings1 : decodedStrings2)[path.node.property.value]));
                        stringConcealingCount++
                    }
                } else if (t.isIdentifier(path.node.property)) {
                    let binding = path.scope.getBinding(path.node.property.name);
                    while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isIdentifier(binding.path.node.init)) {
                        binding = path.scope.getBinding(binding.path.node.init.name);
                    }
                    if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isNumericLiteral(binding.path.node.init)) {
                        path.replaceWith(t.stringLiteral((path.node.object.name == encodedCharsName ? decodedStrings1 : decodedStrings2)[binding.path.node.init.value]));
                        stringConcealingCount++
                    }
                }
            }
        },
        //var cc = 0;
        //var s = {
        //  c: cc++,
        //}
        //console.log(s.c)
        //->
        //var cc = 0;
        //var s = {
        //  c: 0,
        //}
        //console.log(0)
        "AssignmentExpression|VariableDeclarator"(path) {
            const rightOrInit = t.isAssignmentExpression(path.node) ? "right" : "init";
            const leftOrId = t.isAssignmentExpression(path.node) ? "left" : "id";

            if (t.isIdentifier(path.node[leftOrId], { name: highest.key })) {
                if (t.isNumericLiteral(path.node[rightOrInit])) {
                    objectNumberIndexCounter = path.node[rightOrInit].value;
                } else if (t.isIdentifier(path.node[rightOrInit])) {
                    let binding = path.scope.getBinding(path.node[rightOrInit].name);
                    while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && binding.path.node.init && t.isIdentifier(binding.path.node.init)) {
                        binding = path.scope.getBinding(binding.path.node.init.name);
                    }
                    if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isNumericLiteral(binding.path.node.init)) {
                        objectNumberIndexCounter = binding.path.node.init.value;
                    }
                }
            }
        },
        ObjectExpression(path) {
            path.node.properties.forEach((p) => {
                if (t.isObjectProperty(p) && (t.isStringLiteral(p.key) || t.isIdentifier(p.key)) && t.isUpdateExpression(p.value) && p.value.operator === "++" && t.isIdentifier(p.value.argument, { name: highest.key })) {
                    if (t.isSequenceExpression(path.parent)) {
                        path.parent.expressions.forEach((e) => {
                            if (e === path.node) {
                                const assignOrDeclareName = path.parentPath.parent[t.isVariableDeclarator(path.parentPath.parent) ? "id" : "left"].name;
                                if (objectNumbers.get(assignOrDeclareName) == undefined) {
                                    objectNumbers.set(assignOrDeclareName, [])
                                }

                                var te = cloneArrayMap(objectNumbers).get(assignOrDeclareName);
                                te?.push({
                                    value: objectNumberIndexCounter,
                                    prop: p.key[t.isStringLiteral(p.key) ? "value" : "name"],
                                });

                                objectNumbers.set(assignOrDeclareName, te!)
                                p.value = t.numericLiteral(objectNumberIndexCounter);
                                objectNumberIndexCounter++;
                            }
                        })
                    } else {
                        const assignOrDeclareName = path.parent[t.isVariableDeclarator(path.parent) ? "id" : "left"].name;
                        if (objectNumbers.get(assignOrDeclareName) == undefined) {
                            objectNumbers.set(assignOrDeclareName, [])
                        }

                        var te = cloneArrayMap(objectNumbers).get(assignOrDeclareName);
                        te?.push({
                            value: objectNumberIndexCounter,
                            prop: p.key[t.isStringLiteral(p.key) ? "value" : "name"],
                        });

                        objectNumbers.set(assignOrDeclareName, te!)
                        p.value = t.numericLiteral(objectNumberIndexCounter);
                        objectNumberIndexCounter++;
                    }
                }
            });
        },
    });

    traverse(ast, {
        MemberExpression(path) {
            objectNumbers.forEach((e, k) => {
                if (t.isIdentifier(path.node.object) && path.node.object.name == k) {
                    e.forEach((b) => {
                        if (t.isIdentifier(path.node.property) && path.node.property.name == b.prop) {
                            path.replaceWith(t.numericLiteral(b.value));
                            numberConcealingCount++
                        }
                    })
                }
            });
        },
        //const a = 3;
        //const Na = a;
        //const c = {
        //  bb: Na,
        //}
        //->
        //const a = 3;
        //const Na = a;
        //const c = {
        //  bb: 3
        //};
        Identifier(path) {
            if (
                t.isVariableDeclarator(path.parent) && path.key === 'id' ||
                t.isMemberExpression(path.parent) && path.parent.computed !== true ||
                t.isObjectProperty(path.parent) && path.parent.key === path.node
            ) {
                return;
            }

            let binding = path.scope.getBinding(path.node.name);
            while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isIdentifier(binding.path.node.init)) {
                binding = path.scope.getBinding(binding.path.node.init.name);
            }
            if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isLiteral(binding.path.node.init)) {
                path.replaceWith(t.cloneNode(binding.path.node.init));
            }
        },
    });

    traverse(ast, {
        //const c = {
        //  na: 3,
        //}
        //console.log(c.na);
        //->
        //const c = {
        //  na: 3,
        //}
        //console.log(3)
        MemberExpression(path) {
            if (t.isIdentifier(path.node.object)) {
                let binding = path.scope.getBinding(path.node.object.name);
                if (!binding || path.node.computed) {
                    return;
                }
                if (t.isAssignmentExpression(path.parent) && path.parent.left == path.node) {
                    return;
                }
                if (binding.referencePaths && binding.referencePaths.length != 0) {
                    if (
                        binding.referencePaths[0].state && 
                        binding.referencePaths[0].state.assignments && 
                        binding.referencePaths[0].state.assignments.length != 0
                    ) {
                        let last: any = null;
                        binding.referencePaths[0].state.assignments.forEach((e) => {
                            if (t.isObjectExpression(e.node.right) && t.isIdentifier(e.node.left) && e.node.left.name == path.node.object["name"]) {
                                last = e.node;
                            }
                        })
                        if (last == null) return;
                        if (t.isObjectExpression(last.right)) {
                            last.right.properties.forEach((e) => {
                                if (
                                    t.isObjectProperty(e) &&
                                    (t.isIdentifier(e.key) || t.isStringLiteral(e.key)) &&
                                    t.isIdentifier(path.node.property) &&
                                    e.key[t.isStringLiteral(e.key) ? "value" : "name"] === path.node.property.name &&
                                    t.isLiteral(e.value) &&
                                    e.computed !== true
                                ) {
                                    path.replaceWith(e.value);
                                }
                            });
                            return;
                        }
                    }
                }

                if (
                    t.isVariableDeclarator(binding.path.node) &&
                    t.isObjectExpression(binding.path.node.init)
                ) {
                    binding.path.node.init.properties.forEach((e) => {
                        if (
                            t.isObjectProperty(e) &&
                            (t.isIdentifier(e.key) || t.isStringLiteral(e.key)) &&
                            t.isIdentifier(path.node.property) &&
                            e.key[t.isStringLiteral(e.key) ? "value" : "name"] === path.node.property.name &&
                            t.isLiteral(e.value) &&
                            e.computed !== true
                        ) {
                            path.replaceWith(e.value);
                        }
                    });
                }
            }
        },
    })

    //delete anti deobfuscator
    traverse(ast, {
        IfStatement(path) {
            if (
                t.isBinaryExpression(path.node.test) &&
                t.isCallExpression(path.node.test.right) &&
                path.node.test.right.arguments.length == 2 &&
                t.isNewExpression(path.node.test.right.callee) &&
                t.isIdentifier(path.node.test.right.callee.callee) &&
                path.node.test.right.callee.callee.name == "Function"
            ) {
                path.remove();
            }

            //function Ez(e) {
            //    return e > 0 ? e * e : e;
            //}
            //function Sz(i) {
            //  return e.String.fromCharCode(i);
            //}
            //var Qz;
            //if (0 === (Qz = [11616, 5123, 11616, 11398, 5123, 11616, 11398].map(Sz).join(""), -1 !== Ez["toString"]().indexOf(Qz) ? 1 : 0)) {
            //  const i = function () {
            //    for (let t = 0; t < 5; t++) e["addEventListener"]("click", function () {
            //      i();
            //    });
            //  };
            //  i();
            //}
            if (
                path.node != null &&
                t.isBinaryExpression(path.node.test) &&
                t.isSequenceExpression(path.node.test.right) &&
                path.node.test.right.expressions.length === 2 &&
                t.isAssignmentExpression(path.node.test.right.expressions[0]) &&
                t.isIdentifier(path.node.test.right.expressions[0].left) &&
                t.isCallExpression(path.node.test.right.expressions[0].right) &&
                t.isMemberExpression(path.node.test.right.expressions[0].right.callee) &&
                t.isCallExpression(path.node.test.right.expressions[0].right.callee.object) &&
                t.isMemberExpression(path.node.test.right.expressions[0].right.callee.object.callee) &&
                t.isIdentifier(path.node.test.right.expressions[0].right.callee.object.callee.property) &&
                path.node.test.right.expressions[0].right.callee.object.callee.property.name == "map"
            ) {
                const arr = path.node.test.right.expressions[0].right.callee.object.callee.object;
                if (
                    t.isArrayExpression(arr) &&
                    arr.elements.every(el => t.isNumericLiteral(el))
                ) {
                    var binding = path.scope.getBinding(path.node.test.right.expressions[0].left.name)
                    if (t.isVariableDeclarator(binding?.path.node)) {
                        binding.path.remove();
                    }
                    path.remove();
                }
            }

            if (
                path.node != null &&
                path.node.alternate == null &&
                t.isBlockStatement(path.node.consequent) &&
                t.isIdentifier(path.node.test)
            ) {
                let binding = path.scope.getBinding(path.node.test.name)
                if (!binding) {
                    return
                }
                if (
                    t.isVariableDeclarator(binding.path.node) &&
                    t.isCallExpression(binding.path.node.init) &&
                    t.isSequenceExpression(binding.path.node.init.callee) &&
                    binding.path.node.init.callee.expressions.length == 2 &&
                    t.isNumericLiteral(binding.path.node.init.callee.expressions[0]) &&
                    binding.path.node.init.callee.expressions[0].value == 0 &&
                    t.isMemberExpression(binding.path.node.init.callee.expressions[1]) &&
                    binding.path.node.init.callee.expressions[1].computed == true &&
                    t.isBinaryExpression(binding.path.node.init.callee.expressions[1].property) &&
                    t.isIdentifier(binding.path.node.init.callee.expressions[1].object)
                ) {
                    path.remove();
                    binding.path.remove();
                }
            }
        },
        TryStatement(path) {
            if (t.isProgram(path.parent) || t.isBlockStatement(path.parent)) {
                var idx = path.parent.body.indexOf(path.node);
                var tmp = path.parent.body[idx - 1];
                if (
                    idx != -1 &&
                    tmp &&
                    t.isVariableDeclaration(tmp) &&
                    tmp.declarations.length == 1 &&
                    t.isNewExpression(tmp.declarations[0].init) &&
                    t.isIdentifier(tmp.declarations[0].init.callee) &&
                    tmp.declarations[0].init.callee.name == "Function" &&
                    path.node.block.body.length == 1 &&
                    t.isExpressionStatement(path.node.block.body[0])
                ) {
                    path.parent.body[idx - 1] = t.emptyStatement();
                    path.remove();
                }
            }
        },
        //const Gs = Rs + ";let ⲆⵠⵠⵠΔΔⲆᐃⲆ = " + Rs + ";" + "let ⲆⵠⵠΔⵠ = 7279634; try { ⲆⵠⵠΔⵠ = ΔⵠⲆΔⲆⵠⲆ; } catch (ⲆⲆᐃⲆⵠⲆᐃ) { ⲆⵠⵠⵠΔΔⲆᐃⲆ (); };";
        //e["setTimeout"](Gs, 0);
        CallExpression(path) {
            if (
                t.isMemberExpression(path.node.callee) &&
                t.isIdentifier(path.node.callee.object) &&
                path.node.callee.computed == true &&
                t.isStringLiteral(path.node.callee.property) &&
                path.node.callee.property.value == "setTimeout" &&
                path.node.arguments.length == 2 &&
                t.isNumericLiteral(path.node.arguments[1]) &&
                path.node.arguments[1].value == 0 &&
                t.isIdentifier(path.node.arguments[0])
            ) {
                var binding = path.scope.getBinding(path.node.arguments[0].name);
                if (t.isVariableDeclarator(binding?.path.node)) {
                    binding.path.remove();
                }
                path.remove();
            }
        },
        UnaryExpression(path) {
            //function Sz(i) {
            //    return e.String.fromCharCode(i);
            //}
            //!function () {
            //    const i = {
            //      "ⵠⵠⲆⲆΔᐃⲆⲆⵠ": 3886545,
            //      "ⵠⵠᐃⲆΔⲆⵠⵠⲆ": 3347359,
            //      "ⵠᐃΔΔᐃᐃⵠ": 7529066,
            //      "ΔⲆⵠⲆΔⲆᐃᐃΔ": 3094666
            //    };
            //    if (i[[11616, 5123, 916, 916, 5123, 5123, 11616].map(Sz).join("")] !== 7529066) {
            //      const i = function () {
            //        for (let t = 0; t < 5; t++) e["addEventListener"]("click", function () {
            //          i();
            //        });
            //      };
            //      i();
            //    }
            //}();
            if (
                path.node != null &&
                path.node.operator == "!" &&
                t.isCallExpression(path.node.argument) &&
                t.isFunctionExpression(path.node.argument.callee) &&
                path.node.argument.callee.body.body.length == 2 &&
                t.isVariableDeclaration(path.node.argument.callee.body.body[0]) &&
                path.node.argument.callee.body.body[0].declarations.length == 1 &&
                t.isObjectExpression(path.node.argument.callee.body.body[0].declarations[0].init) &&
                t.isIfStatement(path.node.argument.callee.body.body[1])
            ) {
                path.remove();
            }
        },
        ExpressionStatement(path) {
            if ((t.isProgram(path.parent) || t.isBlockStatement(path.parent))) {
                //const Fp = {};
                //Fp.get = function (i, t) {
                //  if ("ⲆΔΔⲆ" !== t) {
                //    const i = e["setTimeout"],
                //      t = i,
                //      n = function () {
                //        i(n, 7038), t(n, 6549);
                //      };
                //    n();
                //  }
                //  return e.Reflect.get(...arguments);
                //};
                //new e.Proxy({}, Fp).ⲆΔΔⲆ;
                if (t.isMemberExpression(path.node.expression)) {
                    if (
                        t.isNewExpression(path.node.expression.object) &&
                        t.isMemberExpression(path.node.expression.object.callee) &&
                        t.isIdentifier(path.node.expression.object.callee.property, { name: 'Proxy' }) &&
                        path.node.expression.object.arguments.length == 2 &&
                        t.isObjectExpression(path.node.expression.object.arguments[0]) &&
                        path.node.expression.object.arguments[0].properties.length == 0 &&
                        t.isIdentifier(path.node.expression.object.arguments[1])
                    ) {
                        //not work if delete binding
                        /*if (path.parent.body[path.parent.body.indexOf(path.node) - 1]) {
                            path.parent.body[path.parent.body.indexOf(path.node) - 1] = t.emptyStatement();
                        }
                        var binding = path.scope.getBinding(path.node.expression.object.arguments[1].name);
                        binding?.path.remove();*/
                        path.remove();
                    }
                }
            }
        },
    })

    console.log(`${stringConcealingCount} concealed string was replaced`);
    console.log(`${numberConcealingCount} object conealed numbers was replaced`);

    const output = generate(
        ast,
        {},
        minified as string
    );

    console.log(`Running webcrack transformers`);

    writeFileSync("./output/deobfuscated.js", (await webcrack(output.code, {
        jsx: false,
        unpack: true,
        deobfuscate: true,
        unminify: true,
        mangle: true,
        onProgress: (c) => {
            console.log(`[webcrack] ${c}% done`)
        },
    })).code)

    console.log(`Code generated`);
})();

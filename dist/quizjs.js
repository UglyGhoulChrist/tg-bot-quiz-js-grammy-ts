import { config } from 'dotenv';
import { Keyboard, GrammyError, HttpError, Bot, session } from 'grammy';
import fs from 'node:fs/promises';
import path from 'node:path';

const commands = [
    { command: 'help', description: 'Помощь' },
    { command: 'start', description: 'Приветствие' },
    { command: 'question', description: 'Получить вопрос' },
    { command: 'progress', description: 'Прогресс викторины' }
];

const descriptionHelp = 'Бот задает вопросы по JavaScript. Для каждого вопроса доступно четыре варианта ответа, один из которых является верным. После выбора ответа бот предоставит объяснение к вопросу и сообщит, правильно ли был выбран ответ.';
const descriptionStart = 'Привет! Я <b>QuizJS</b> - викторина по JavaScript - что будет выведено в консоль?';
const descriptionBadMessage = 'Я пока только умею задавать вопросы. Воспользуйтесь командами или кнопками на клавиатуре.';

async function handleHelpCommand(ctx) {
    try {
        await ctx.reply(descriptionHelp, { parse_mode: 'HTML' });
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        }
        else {
            console.log('Произошла неизвестная ошибка');
        }
    }
}

const keyboardFirstQuiz = new Keyboard()
    .text('Первый вопрос')
    .resized();
const keyboardNextQuiz = new Keyboard()
    .text('Следующий вопрос')
    .resized();
const keyboardOptions = new Keyboard()
    .text('Вариант 1')
    .text('Вариант 2')
    .text('Вариант 3')
    .text('Вариант 4')
    .resized();

async function handleStartCommand(ctx) {
    try {
        await ctx.reply(descriptionStart, {
            parse_mode: 'HTML',
            reply_markup: keyboardFirstQuiz
        });
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        }
        else {
            console.log('Произошла неизвестная ошибка');
        }
    }
}

async function handleBotError(err) {
    const ctx = err.ctx;
    console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error('Ошибка в запросе:', e.description);
    }
    else if (e instanceof HttpError) {
        console.error('Не удалось связаться с Telegram:', e);
    }
    else {
        console.error('Неизвестная ошибка:', e);
    }
}

async function getUserId(ctx) {
    const userId = ctx.from?.id;
    if (!userId) {
        await ctx.reply('Не удалось идентифицировать пользователя.');
    }
    return userId;
}

class UserState {
    stateDirPath = path.join('state');
    constructor() {
        this.initStateDir();
    }
    async initStateDir() {
        try {
            await fs.access(this.stateDirPath);
        }
        catch {
            await fs.mkdir(this.stateDirPath, { recursive: true });
        }
    }
    async getUserFilePath(userId) {
        return path.join(this.stateDirPath, `${userId}.json`);
    }
    async ensureFileExists(filePath) {
        try {
            await fs.access(filePath);
        }
        catch {
            await fs.writeFile(filePath, JSON.stringify({ countQuiz: 0, correctAnswer: 0 }), 'utf8');
        }
    }
    async getUserState(userId) {
        const filePath = await this.getUserFilePath(userId);
        await this.ensureFileExists(filePath);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    }
    async saveUserState(userId, userState) {
        const filePath = await this.getUserFilePath(userId);
        const data = JSON.stringify(userState, null, 2);
        await fs.writeFile(filePath, data, 'utf8');
    }
    async incrementQuizCount(userId) {
        const userState = await this.getUserState(userId);
        userState.countQuiz += 1;
        await this.saveUserState(userId, userState);
    }
    async incrementCorrectAnswer(userId) {
        const userState = await this.getUserState(userId);
        userState.correctAnswer += 1;
        await this.saveUserState(userId, userState);
    }
}

async function handleProgressCommand(ctx) {
    const userId = await getUserId(ctx);
    if (userId) {
        const userState = await new UserState().getUserState(userId);
        try {
            await ctx.reply(`Вы ответили правильно на ${userState.correctAnswer} из ${userState.countQuiz} вопросов викторины!`);
        }
        catch (error) {
            if (error instanceof Error) {
                console.log(error.message);
            }
            else {
                console.log('Произошла неизвестная ошибка');
            }
        }
    }
}

async function handleAnswerButtonClick(ctx) {
    const userId = await getUserId(ctx);
    if (!userId) {
        return;
    }
    if (!ctx.session.quiz) {
        await ctx.reply('Сначала начните игру командой /question.');
        return;
    }
    const userState = new UserState();
    await userState.incrementQuizCount(userId);
    const selectedOption = parseInt(ctx.match[1]);
    const isCorrect = ctx.session.quiz.correct === selectedOption - 1;
    ctx.session.quiz.isCorrect = isCorrect;
    if (isCorrect) {
        await userState.incrementCorrectAnswer(userId);
    }
    await ctx.reply(ctx.session.quiz.getIsCorrectAndExplanationHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardNextQuiz
    });
}

const listQuiz = [
    {
        "id": 1,
        "question": "function sayHi() {\r\n  console.log(name)\r\n  console.log(age)\r\n  var name = &quot;John&quot;\r\n  let age = 30\r\n}\r\n\r\nsayHi()",
        "options": [
            "John и undefined",
            "John и ошибка",
            "ошибка",
            "undefined и ошибка"
        ],
        "correct": 3,
        "explanation": "В функции <b>sayHi</b> мы сначала определяем переменную <b>name</b> с помощью ключевого слова <b>var</b>. Это означает, что <b>name</b> поднимается в начало функции. <b>name</b> будет иметь значение <b>undefined</b> до тех пор, пока выполнение кода не дойдет до строки, где ей присваивается значение <b>John</b>. Мы еще не определили значение <b>name</b>, когда пытаемся вывести ее значение в консоль, поэтому получаем <b>undefined</b>. Переменные, объявленные с помощью ключевых слов <b>let</b> и <b>const</b>, также поднимаются в начало области видимости, но в отличие от переменных, объявленных с помощью <b>var</b>, не инициализируются, т.е. такие переменные поднимаются без значения. Доступ к ним до инициализации невозможен. Это называется <b>временной мертвой зоной</b>. Когда мы пытаемся обратиться к переменным до их определения, <b>JavaScript</b> выбрасывает исключение <b>ReferenceError</b>."
    },
    {
        "id": 2,
        "question": "for (var i = 0; i &lt; 3; i++) {\r\n  setTimeout(() =&gt; console.log(i), 1)\r\n}\r\n\r\nfor (let i = 0; i &lt; 3; i++) {\r\n  setTimeout(() =&gt; console.log(i), 1)\r\n}",
        "options": [
            "0 1 2 и 0 1 2",
            "0 1 2 и 3 3 3",
            "3 3 3 и 0 1 2",
            "3 3 3 и 3 3 3"
        ],
        "correct": 2,
        "explanation": "Из-за очереди событий в <b>JavaScript</b> функция обратного вызова <b>setTimeout</b> выполняется после освобождения стека вызовов. Так как переменная <b>i</b> в первом цикле определяется с помощью ключевого слова <b>var</b>, она является глобальной. В цикле мы каждый раз увеличиваем значение <b>i</b> на <b>1</b>, используя оператор <b>++</b>. К моменту выполнения <b>setTimeout</b> в первом примере значение <b>i</b> равняется <b>3</b>. Во втором цикле переменная <b>i</b> определяется с помощью ключевого слова <b>let</b>. Такие переменные (а также переменные, объявленные с помощью ключевого слова <b>const</b>) имеют блочную область видимости (блок - это код внутри фигурных скобок - <b>{}</b>). На каждой итерации <b>i</b> будет иметь новое значение, и это значение будет замкнуто в области видимости внутри цикла."
    },
    {
        "id": 3,
        "question": "const shape = {\r\n  radius: 10,\r\n  diameter() {\r\n    return this.radius * 2\r\n  },\r\n  perimeter: () =&gt; 2 * Math.PI * this.radius\r\n}\r\n\r\nconsole.log(shape.diameter())\r\nconsole.log(shape.perimeter())",
        "options": [
            "20 и 62.83185307179586",
            "20 и NaN",
            "20 и 63",
            "NaN и 63"
        ],
        "correct": 1,
        "explanation": "Обратите внимание, что <b>diameter</b> - это обычная функция, а <b>perimeter</b> - стрелочная. У стрелочных функций, в отличие от обычных, значение <b>this</b> указывает на внешнее/лексическое окружение. Это значит, что при вызове метода <b>perimeter</b> его <b>this</b> указывает не на объект <b>shape</b>, а на глобальный объект <b>window</b>. У этого объекта нет свойства <b>radius</b>, поэтому возвращается <b>undefined</b>."
    },
    {
        "id": 4,
        "question": "console.log(+true)\r\nconsole.log(!&quot;John&quot;)",
        "options": [
            "1 и false",
            "0 и true",
            "false и NaN",
            "false и false"
        ],
        "correct": 0,
        "explanation": "Унарный плюс (<b>+</b>) приводит операнд к числу. <b>true</b> - это <b>1</b>, а <b>false</b> - <b>0</b>. Строка <b>John</b> - это истинное значение. Мы спрашиваем, является ли это значение ложным? Ответ: <b>false</b>."
    },
    {
        "id": 5,
        "question": "let c = { greeting: &quot;Hey!&quot; }\r\nlet d\r\n\r\nd = c\r\nc.greeting = &quot;Hello!&quot;\r\nconsole.log(d.greeting)",
        "options": [
            "Hello!",
            "Hey!",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "В <b>JavaScript</b> все объекты являются &quot;ссылочными&quot; типами данных, т.е. значения объектов передаются по ссылкам. Сначала в переменной <b>c</b> создается ссылка на объект. Затем мы указываем переменной <b>d</b> ссылаться на тот же объект, на который ссылается <b>c</b>. При изменении объекта меняются значения всех указывающих на него ссылок."
    },
    {
        "id": 6,
        "question": "let a = 3\r\nlet b = new Number(3)\r\nlet c = 3\r\n\r\nconsole.log(a == b)\r\nconsole.log(a === b)\r\nconsole.log(b === c)",
        "options": [
            "true false true",
            "false false true",
            "true false false",
            "false true true"
        ],
        "correct": 2,
        "explanation": "<b>new Number</b> - это встроенная функция-конструктор. И хотя она выглядит как число, это не настоящее число: у него имеется ряд дополнительных возможностей. На самом деле это объект. Оператор <b>==</b> (абстрактное/нестрогое равенство) разрешает преобразование типов данных, он проверяет равенство значений. Оба значения равны <b>3</b>, поэтому возвращается <b>true</b>. При использовании оператора <b>===</b> (строговое равенство, оператор идентичности) должны совпадать не только значения, но и типы данных. В данном случае это не так: <b>new Number()</b> - это не число, а объект. Поэтому два последних сравнения возвращают <b>false</b>."
    },
    {
        "id": 7,
        "question": "class Chameleon {\r\n  static colorChange(newColor) {\r\n    this.newColor = newColor\r\n    return this.newColor\r\n  }\r\n\r\n  constructor({ newColor = &quot;green&quot; } = {}) {\r\n    this.newColor = newColor\r\n  }\r\n}\r\n\r\nconst freddie = new Chameleon({ newColor: &quot;pink&quot; })\r\nfreddie.colorChange(&quot;orange&quot;)",
        "options": [
            "orange",
            "pink",
            "green",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Метод <b>colorChange</b> является статическим. Такие методы не имеют доступа к экземплярам класса. Так как <b>freddie</b> - это экземпляр, статический метод в нем не доступен. Поэтому выбрасывается исключение <b>TypeError</b>."
    },
    {
        "id": 8,
        "question": "// обратите внимание: код выполняется в нестрогом режиме\r\nlet greeting\r\ngreetign = {} // опечатка!\r\nconsole.log(greetign)",
        "options": [
            "{}",
            "ошибка",
            "undefined",
            "&quot;&quot;"
        ],
        "correct": 0,
        "explanation": "С помощью выражения <b>greetign = {}</b> мы создаем новый глобальный пустой объект, который выводится в консоль. Когда мы вместо <b>greeting</b> написали <b>greetign</b>, интерпретатор выполнил <b>global.greetign = {}</b> в <b>Node.js</b> (или <b>window.greetign = {}</b> в браузере). В строгом режиме (<b>&quot;use strict&quot;</b>) будет выброшено исключение <b>ReferenceError: greetign is not defined</b>."
    },
    {
        "id": 9,
        "question": "function bark() {\r\n  console.log(&quot;Woof!&quot;)\r\n}\r\n\r\nbark.animal = &quot;dog&quot;\r\n\r\nconsole.log(bark.animal)",
        "options": [
            "dog",
            "ошибка",
            "undefined",
            "&quot;&quot;"
        ],
        "correct": 0,
        "explanation": "В <b>JavaScript</b> такое возможно, т.к. функции в <b>JS</b> - это тоже объекты. Точнее, функция — это специальный тип объекта, который можно вызывать (такой объект имеет внутренний слот <b>callable</b>). Кроме того, функция — это объект со свойствами, вызывать которые нельзя, поскольку они не являются функциями."
    },
    {
        "id": 10,
        "question": "function Person(firstName, lastName) {\r\n  this.firstName = firstName\r\n  this.lastName = lastName\r\n}\r\n\r\nconst person = new Person(&quot;John&quot;, &quot;Smith&quot;)\r\nPerson.getFullName = function () {\r\n  return `${this.firstName} ${this.lastName}`\r\n}\r\n\r\nconsole.log(person.getFullName())",
        "options": [
            "ошибка",
            "&quot;&quot;",
            "John Smith",
            "undefined undefined"
        ],
        "correct": 0,
        "explanation": "Нельзя добавлять свойства к конструктору как к обычному объекту. Если необходимо добавить свойство или метод всем экземплярам, то следует использовать прототипы. В данном случае выражение <b>Person.prototype.getFullName = function () { return </b>${this.firstName} ${this.lastName}<b> }</b> сделает метод <b>getFullName</b> рабочим. В чем здесь преимущество? Предположим, что мы добавили этот метод к конструктору. Возможно, он нужен не каждому экземпляру класса <b>Person</b>. Это приведет к лишнему расходованию памяти, т.к. все экземпляры будут иметь указанный метод. Напротив, если мы добавим данный метод к прототипу, у нас будет только одно место в памяти, к которому смогут обращаться все экземпляры. Такие методы называются совместными или распределенными (shared)."
    },
    {
        "id": 11,
        "question": "function Person(firstName, lastName) {\r\n  this.firstName = firstName\r\n  this.lastName = lastName\r\n}\r\n\r\nconst john = new Person(&quot;John&quot;, &quot;Smith&quot;)\r\nconst jane = Person(&quot;Jane&quot;, &quot;Air&quot;)\r\n\r\nconsole.log(john)\r\nconsole.log(jane)",
        "options": [
            "Person {firstName: &quot;John&quot;, lastName: &quot;Smith&quot;} и undefined",
            "Person {firstName: &quot;John&quot;, lastName: &quot;Smith&quot;} и Person {firstName: &quot;Jane&quot;, lastName: &quot;Air&quot;}",
            "Person {firstName: &quot;John&quot;, lastName: &quot;Smith&quot;} и {}",
            "Person {firstName: &quot;Smith&quot;, lastName: &quot;Smith&quot;} и ошибка"
        ],
        "correct": 0,
        "explanation": "Мы создаем объект <b>jane</b> без помощи ключевого слова <b>new</b>. Использование <b>new</b> приводит к созданию нового объекта (экземпляра). Без <b>new</b> создается глобальный объект. Мы указали, что <b>this.firstName</b> равняется <b>Jane</b> и <b>this.lastName</b> равняется <b>Air</b>. На самом деле, мы определили <b>global.firstName = &#39;Jane&#39;</b> и <b>global.lastName = &#39;Air&#39;</b>. Значением <b>jane</b> является <b>undefined</b>, поскольку мы ничего не возвращаем из функции <b>Person</b>."
    },
    {
        "id": 12,
        "question": "function sum(a, b) {\r\n  return a + b\r\n}\r\n\r\nconsole.log(sum(1, &quot;2&quot;))",
        "options": [
            "NaN",
            "ошибка",
            "&quot;12&quot;",
            "3"
        ],
        "correct": 2,
        "explanation": "<b>JavaScript</b> - это динамически типизированный язык: мы не определяем тип данных при объявлении переменных (для этого был придуман <b>TypeScript</b>). Значения переменных могут быть автоматически преобразованы из одного типа в другой без нашего участия. Это называется &quot;неявным приведением типов&quot;. Приведение - это преобразование данных из одного типа в другой. В рассматриваемом примере <b>JavaScript</b> конвертировал число <b>1</b> в строку, чтобы операция имела смысл и вернула хоть какое-то значение. При сложении числа (<b>1</b>) и строки (<b>&quot;2&quot;</b>) число преобразуется в строку. Мы можем объединять строки так: <b>&quot;Hello&quot; + &quot;World&quot;</b>. Это называется конкатенацией строк. Таким образом, <b>1 + &quot;2&quot;</b> возвращает <b>&quot;12&quot;</b>."
    },
    {
        "id": 13,
        "question": "let number = 0\r\nconsole.log(number++)\r\nconsole.log(++number)\r\nconsole.log(number)",
        "options": [
            "1 1 2",
            "1 2 2",
            "0 2 2",
            "0 1 2"
        ],
        "correct": 2,
        "explanation": "Постфиксный оператор <b>++</b>:\r\n- возвращает значение (<b>0</b>);\r\n- увеличивает (инкрементирует) значение (после чего значением переменной <b>number</b> становится <b>1</b>).\r\nПрефиксный оператор <b>++</b>:\r\n- инкрементирует значение (теперь <b>number === 2</b>);\r\n- возвращает значение (<b>2</b>).\r\nРезультат: <b>0 2 2</b>."
    },
    {
        "id": 14,
        "question": "function getPersonInfo(one, two, three) {\r\n  console.log(one)\r\n  console.log(two)\r\n  console.log(three)\r\n}\r\n\r\nconst person = &quot;John&quot;\r\nconst age = 30\r\n\r\ngetPersonInfo`${person} is ${age} years old`",
        "options": [
            "John 30 [&quot;&quot;, &quot; is &quot;, &quot; years old&quot;]",
            "[&quot;&quot;, &quot; is &quot;, &quot; years old&quot;] John 30",
            "John [&quot;&quot;, &quot; is &quot;, &quot; years old&quot;] 30",
            "undefined"
        ],
        "correct": 1,
        "explanation": "При использовании тегированных шаблонных литералов (tagged template literals) первым значением, возвращаемым функцией, является массив строк. Прочими значениями являются значения, переданные функции в качестве аргументов."
    },
    {
        "id": 15,
        "question": "function checkAge(data) {\r\n  if (data === { age: 18 }) {\r\n    console.log(&quot;Ты взрослый!&quot;)\r\n  } else if (data == { age: 18 }) {\r\n    console.log(&quot;Ты по-прежнему взрослый.&quot;)\r\n  } else {\r\n    console.log(&quot;Хм... У тебя что, нет возраста?&quot;)\r\n  }\r\n}\r\n\r\ncheckAge({ age: 18 })",
        "options": [
            "Ты взрослый!",
            "Ты по-прежнему взрослый.",
            "Хм... У тебя что, нет возраста?",
            "undefined"
        ],
        "correct": 2,
        "explanation": "В операциях сравнения примитивы сравниваются по значениям, а объекты - по ссылкам. <b>JavaScript</b> проверяет, чтобы объекты указывали на одну и ту же область памяти. Сравниваемые объекты в рассматриваемом примере не такие: объект, переданный в качестве аргумента, указывает на другое место в памяти, нежели объекты, используемые в сравнениях. Поэтому выражения <b>{ age: 18 } === { age: 18 }</b> и <b>{ age: 18 } == { age: 18 }</b> возвращают <b>false</b>."
    },
    {
        "id": 16,
        "question": "function getAge(...args) {\r\n  console.log(typeof args)\r\n}\r\n\r\ngetAge(30)",
        "options": [
            "number",
            "array",
            "object",
            "NaN"
        ],
        "correct": 2,
        "explanation": "Оператор распространения или расширения (spread, <b>...</b>) возвращает массив с аргументами, переданными функции. Массив - это объект, поэтому выражение <b>typeof args</b> возвращает <b>object</b>."
    },
    {
        "id": 17,
        "question": "function getAge() {\r\n  &quot;use strict&quot;\r\n  age = 30\r\n  console.log(age)\r\n}\r\n\r\ngetAge()",
        "options": [
            "30",
            "undefined",
            "ошибка",
            "NaN"
        ],
        "correct": 2,
        "explanation": "<b>&quot;use strict&quot;</b>, среди прочего, позволяет предотвратить случайное объявление глобальных переменных. Мы не объявляли переменную <b>age</b>, поэтому (в строгом режиме) выбрасывается исключение <b>ReferenceError</b>. В нестрогом режиме ошибки не возникнет, а переменная <b>age</b> станет свойством глобального объекта <b>window</b>."
    },
    {
        "id": 18,
        "question": "const sum = eval(&quot;10*10+5&quot;)\r\n\r\nconsole.log(sum)",
        "options": [
            "105",
            "&quot;105&quot;",
            "ошибка",
            "&quot;10*10+5&quot;"
        ],
        "correct": 0,
        "explanation": "Функция <b>eval</b> выполняет код, переданный ей в виде строки. Если это выражение (как в данном случае), то оно вычисляется (оценивается). Выражение <b>10 * 10 + 5</b> возвращает число <b>105</b>. Использовать <b>eval</b> не рекомендуется по причинам безопасности."
    },
    {
        "id": 19,
        "question": "var num = 8\r\nvar num = 10\r\n\r\nconsole.log(num)",
        "options": [
            "8",
            "10",
            "undefined",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "С помощью ключевого слова <b>var</b> можно определять любое количество одноименных переменных. Переменная будет хранить последнее присвоенное ей значение. Однако, такой трюк нельзя проделать с <b>let</b> и <b>const</b>, т.к. переменные, объявленные с помощью этих ключевых слов, имеют блочную область видимости."
    },
    {
        "id": 20,
        "question": "const obj = { 1: &quot;a&quot;, 2: &quot;b&quot;, 3: &quot;c&quot; }\r\nconst set = new Set([1, 2, 3, 4, 5])\r\n\r\nconsole.log(obj.hasOwnProperty(&quot;1&quot;))\r\nconsole.log(obj.hasOwnProperty(1))\r\nconsole.log(set.has(&quot;1&quot;))\r\nconsole.log(set.has(1))",
        "options": [
            "false true false true",
            "false true true true",
            "true true false true",
            "true true true true"
        ],
        "correct": 2,
        "explanation": "Ключи объектов (кроме <b>Symbol</b>) являются строками, даже если заданы не в виде строк (например, индексы в массиве). Поэтому выражение <b>obj.hasOwnProperty(&#39;1&#39;)</b> также возвращает <b>true</b>. Однако, это не работает с <b>Set</b>. Значение <b>1</b> отсутствует в <b>set</b>: <b>set.has(&#39;1&#39;)</b> возвращает <b>false</b>, а <b>set.has(1)</b> - <b>true</b>."
    },
    {
        "id": 21,
        "question": "const obj = { a: &quot;one&quot;, b: &quot;two&quot;, a: &quot;three&quot; }\r\nconsole.log(obj)",
        "options": [
            "{ a: &quot;one&quot;, b: &quot;two&quot; }",
            "{ b: &quot;two&quot;, a: &quot;three&quot; }",
            "{ a: &quot;three&quot;, b: &quot;two&quot; }",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "Если в объекте имеется два ключа с одинаковыми именами, то первый ключ перезаписывается. Его позиция сохраняется, а значением становится последнее из присвоенных."
    },
    {
        "id": 22,
        "question": "for (let i = 1; i &lt; 5; i++) {\r\n  if (i === 3) continue\r\n  console.log(i)\r\n}",
        "options": [
            "1 2",
            "1 2 3",
            "1 2 4",
            "1 3 4"
        ],
        "correct": 2,
        "explanation": "Оператор <b>continue</b> пропускает текущую итерацию (цикл), если условие удовлетворяется (является истинным)."
    },
    {
        "id": 23,
        "question": "String.prototype.giveMePizza = () =&gt; {\r\n  return &quot;Give me pizza!&quot;\r\n}\r\n\r\nconst name = &quot;John&quot;\r\n\r\nconsole.log(name.giveMePizza())",
        "options": [
            "Give me pizza!",
            "ошибка",
            "&quot;&quot;",
            "undefined"
        ],
        "correct": 0,
        "explanation": "<b>String</b> - это встроенный конструктор, к которому можно добавлять новые свойства. Мы добавили метод <b>giveMePizza</b> к его прототипу. Строки-примитивы автоматически конвертируются (преобразуются) в строки-объекты (благодаря объектной обертке). Поэтому все строки (объекты) имеют доступ к указанному методу."
    },
    {
        "id": 24,
        "question": "const a = {}\r\nconst b = { key: &quot;b&quot; }\r\nconst c = { key: &quot;c&quot; }\r\n\r\na[b] = 123\r\na[c] = 456\r\n\r\nconsole.log(a[b])",
        "options": [
            "123",
            "456",
            "undefined",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "Ключи объекта (кроме <b>Symbol</b>) автоматически преобразуются в строки (даже индексы в массиве). Мы пытаемся добавить объект в качестве ключа со значением <b>123</b> к объекту <b>a</b>. Однако, когда мы приводим объект к строке, он превращается в <b>[object Object]</b>. Таким образом, мы говорим, что <b>a[&quot;object Object&quot;] = 123</b>. Затем мы повторяем процедуру. <b>c</b> - это другой объект, который мы также неявно приводим к строке. Поэтому <b>a[&quot;object Object&quot;] = 456</b>. Наконец, когда мы выводим <b>a[b]</b> в консоль, мы на самом деле обращаемся к <b>a[&quot;object Object&quot;]</b>. Поэтому в консоль выводится <b>456</b>."
    },
    {
        "id": 25,
        "question": "const foo = () =&gt; console.log(&quot;first&quot;)\r\nconst bar = () =&gt; setTimeout(() =&gt; console.log(&quot;second&quot;))\r\nconst baz = () =&gt; console.log(&quot;third&quot;)\r\n\r\nbar()\r\nfoo()\r\nbaz()",
        "options": [
            "first second third",
            "first third second",
            "second first third",
            "second third first"
        ],
        "correct": 1,
        "explanation": "Сначала мы вызываем функцию <b>setTimeout</b>. Однако, ее колбек выполняется последним. Это происходит из-за того, что в браузерах у нас имеется не только движок для запуска (выполнения) кода, но и <b>WebAPI</b>. <b>WebAPI</b> предоставляет нам <b>setTimeout</b> и много других возможностей, например, <b>DOM</b>. После того, как <b>setTimeout</b> отправляется в <b>WebAPI</b>, функция <b>bar</b> удаляется из стека вызовов (call stack). После этого вызывается функция <b>foo</b>, и <b>first</b> выводится в консоль. <b>foo</b> удаляется из стека и вызывается функция <b>baz</b>. <b>third</b> выводится в консоль. <b>WebAPI</b> отправляет функцию обратного вызова <b>setTimeout</b> в очередь событий (task queue, второе слово читается как &quot;кью&quot;). Цикл событий (event loop) проверяет стек вызовов и очередь задач. Если стек оказывается пустым, то в него помещается первый элемент из очереди. Вызывается функция <b>bar</b> и в консоль выводится <b>second</b>."
    },
    {
        "id": 26,
        "question": "&lt;div onclick=&quot;console.log(&#39;div&#39;)&quot;&gt;\r\n  &lt;p onclick=&quot;console.log(&#39;p&#39;)&quot;&gt;\r\n    Нажми меня!\r\n  &lt;/p&gt;\r\n&lt;/div&gt;",
        "options": [
            "p div",
            "div p",
            "p",
            "div"
        ],
        "correct": 0,
        "explanation": "После клика по элементу <b>p</b> в консоль будет выведено <b>p</b> и <b>div</b>. Поток события (распространение события) имеет три фазы: захват, цель и всплытие. По умолчанию обработчики событий выполняются на фазе всплытия (если не установлен параметр <b>useCapture</b> со значением <b>true</b>). Всплытие происходит от самого глубоко вложенного элемента до самого внешнего."
    },
    {
        "id": 27,
        "question": "const person = { name: &quot;John&quot; }\r\n\r\nfunction sayHi(age) {\r\n  console.log(`${this.name} is ${age}`)\r\n}\r\n\r\nsayHi.call(person, 30)\r\nsayHi.bind(person, 30)",
        "options": [
            "undefined is 30 и John is 30",
            "function и function",
            "John is 30 и John is 30",
            "John is 30 и function"
        ],
        "correct": 3,
        "explanation": "В обоих случаях мы передаем объект, на который будет указывать <b>this</b>. Но метод <b>call</b> выполняется сразу, а метод <b>bind</b> возвращает копию функции с привязанным контекстом. Эту функцию следует вызывать отдельно или можно сделать так: <b>sayHi.bind(person, 30)()</b>."
    },
    {
        "id": 28,
        "question": "function sayHi() {\r\n  return (() =&gt; 0)()\r\n}\r\n\r\nconsole.log(typeof sayHi())",
        "options": [
            "object",
            "number",
            "function",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Функция <b>sayHi</b> возвращает значение немедленно вызываемого функционального выражения (Immediately Invoked Function Expression, IIFE). Результатом является число <b>0</b> типа <b>number</b>. Для информации: в <b>JavaScript</b> имеется <b>8</b> встроенных типов данных: <b>string, number, bigint, boolean, null, undefined, object и symbol</b>. <b>function</b> не является отдельным типом, функции - это объекты."
    },
    {
        "id": 29,
        "question": "console.log(typeof typeof 1)",
        "options": [
            "number",
            "string",
            "object",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Выражение <b>typeof 1</b> возвращает <b>number</b>. Выражение <b>typeof number</b> возвращает <b>string</b>."
    },
    {
        "id": 30,
        "question": "const numbers = [1, 2, 3]\r\nnumbers[10] = 11\r\nconsole.log(numbers)",
        "options": [
            "[1, 2, 3, 7 x null, 11]",
            "[1, 2, 3, 11]",
            "[1, 2, 3, 7 x empty, 11]",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "Когда в массив добавляется значение, которое выходит за пределы длины массива, <b>JavaScript</b> создает &quot;пустые ячейки&quot;. На самом деле они имеют значение <b>undefined</b>, но в консоль выводятся как <b>[1, 2, 3, 7 x empty, 11]</b> (зависит от среды выполнения кода, от браузера)."
    },
    {
        "id": 31,
        "question": "(() =&gt; {\r\n  let x, y\r\n  try {\r\n    throw new Error()\r\n  } catch (x) {\r\n    (x = 1), (y = 2)\r\n    console.log(x)\r\n  }\r\n  console.log(x)\r\n  console.log(y)\r\n})()",
        "options": [
            "1 undefined 2",
            "undefined undefined undefined",
            "1 1 2",
            "1 undefined undefined"
        ],
        "correct": 0,
        "explanation": "Блок <b>catch</b> принимает параметр <b>x</b>. Это не тот <b>x</b>, который объявлен перед блоком <b>try</b>. Мы присваиваем этому аргументу значение <b>1</b>, а переменной <b>y</b> - <b>2</b>. После этого мы выводим в консоль значение <b>x</b>, т.е. <b>1</b>. За пределами catch <b>x</b> все еще имеет значение <b>undefined</b>, а <b>y</b> - <b>2</b>. Когда мы вызываем <b>console.log(x)</b> за пределами <b>catch</b>, возвращается <b>undefined</b>, а <b>console.log(y)</b> возвращает <b>2</b>."
    },
    {
        "id": 32,
        "question": "const result =\r\n  [[0, 1], [2, 3]].reduce(\r\n    (acc, cur) =&gt; {\r\n      return acc.concat(cur)\r\n    },\r\n    [1, 2]\r\n  )\r\n\r\nconsole.log(result)",
        "options": [
            "[0, 1, 2, 3, 1, 2]",
            "[6, 1, 2]",
            "[1, 2, 0, 1, 2, 3]",
            "[1, 2, 6]"
        ],
        "correct": 2,
        "explanation": "<b>[1, 2]</b> - начальное значение переменной <b>acc</b>. После первого прохода <b>acc</b> равняется <b>[1, 2]</b>, а <b>cur</b> - <b>[0, 1]</b>. После конкатенации (объединения) <b>acc</b> равняется <b>[1, 2, 0, 1]</b>, а <b>cur</b> - <b>[2, 3]</b>. После их объединения, мы получаем <b>[1, 2, 0, 1, 2, 3]</b>."
    },
    {
        "id": 33,
        "question": "console.log(!!null)\r\nconsole.log(!!&quot;&quot;)\r\nconsole.log(!!1)",
        "options": [
            "false true false",
            "false false true",
            "false true true",
            "true true false"
        ],
        "correct": 1,
        "explanation": "<b>null</b> - это <b>false</b>. <b>!null</b> возвращает <b>true</b>. <b>!true</b> возвращает <b>false</b>.\r\n<b>&quot;&quot;</b> - это <b>false</b>. <b>!&quot;&quot;</b> возвращает <b>true</b>. <b>!true</b> возвращает <b>false</b>.\r\n<b>1</b> - это <b>true</b>. <b>!1</b> возвращает <b>false</b>. <b>!false</b> возвращает <b>true</b>."
    },
    {
        "id": 34,
        "question": "console.log([...&quot;John&quot;])",
        "options": [
            "[&quot;J&quot;, &quot;o&quot;, &quot;h&quot;, &quot;n&quot;]",
            "[&quot;John&quot;]",
            "[[], &quot;John&quot;]",
            "[[&quot;J&quot;, &quot;o&quot;, &quot;h&quot;, &quot;n&quot;]]"
        ],
        "correct": 0,
        "explanation": "Строка является итерируемой (перебираемой) сущностью. Оператор распространения или расширения (spread, <b>...</b>) преобразует строку в массив, состоящий из символов этой строки."
    },
    {
        "id": 35,
        "question": "function* generator(i) {\r\n  yield i\r\n  yield i * 2\r\n}\r\n\r\nconst gen = generator(10)\r\n\r\nconsole.log(gen.next().value)\r\nconsole.log(gen.next().value)",
        "options": [
            "[0, 10] и [10, 20]",
            "20 и 20",
            "10 и 20",
            "0, 10 и 10, 20"
        ],
        "correct": 2,
        "explanation": "Выполнение обычных функций не может быть остановлено после их запуска. Однако, генераторы можно останавливать в процессе выполнения, а затем продолжать с места остановки. Каждый раз, когда в функции-генераторе встречается ключевое слово <b>yield</b>, функция возвращает значение, указанное после него. Обратите внимание, что в генераторе вместо <b>return</b> используется <b>yield</b>. Сначала мы инициализируем генератор с <b>i</b> равным <b>10</b>. Мы вызываем генератор, используя метод <b>next</b>. Когда мы в первый раз вызываем генератор, <b>i</b> равняется <b>10</b>. Движок <b>JavaScript</b> встречает первое ключевое слово <b>yield</b> и возвращает значение <b>i</b>. После этого выполнение функции приостанавливается и <b>10</b> выводится в консоль. Затем мы снова вызываем функцию посредством <b>next()</b>. Она запускается с того места, где остановилась, с <b>i</b> равным <b>10</b>. Движок встречает следующее ключевое слово <b>yield</b> и возвращает <b>i * 2</b>. <b>i</b> равно <b>10</b>, поэтому возвращается <b>20</b>."
    },
    {
        "id": 36,
        "question": "const firstPromise = new Promise((res, rej) =&gt; {\r\n  setTimeout(res, 500, &quot;one&quot;)\r\n})\r\n\r\nconst secondPromise = new Promise((res, rej) =&gt; {\r\n  setTimeout(res, 100, &quot;two&quot;)\r\n})\r\n\r\nPromise.race([firstPromise, secondPromise]).then(res =&gt; console.log(res))",
        "options": [
            "one",
            "two",
            "two one",
            "one two"
        ],
        "correct": 1,
        "explanation": "Когда мы передаем несколько промисов методу <b>race</b>, он возвращает первый разрешенный (выполненный или отклоненный) промис. В функцию <b>setTimeout</b> мы передаем задержку в <b>500</b> мс для первого промиса и в <b>100</b> мс - для второго. Это означает, что <b>secondPromise</b> разрешается первым со значением <b>two</b>. Переменная <b>res</b> имеет значение <b>two</b>, которое и выводится в консоль."
    },
    {
        "id": 37,
        "question": "let person = { name: &quot;John&quot; }\r\nconst members = [person]\r\nperson = null\r\n\r\nconsole.log(members)",
        "options": [
            "null",
            "[null]",
            "[{}]",
            "[{ name: &quot;John&quot; }]"
        ],
        "correct": 3,
        "explanation": "Сначала мы объявляем переменную <b>person</b> со значением объекта, содержащего свойство <b>name</b>. Затем мы объявляем переменную <b>members</b>. Мы делаем первый элемент этого массива равным <b>[person]</b>. Объекты взаимодействуют посредством ссылок при установке их равными друг другу. Когда мы назначаем ссылку из одной переменной в другую, создается копия этой ссылки (обратите внимание, что у этих переменных не одинаковые ссылки). Затем мы присваиваем переменной <b>person</b> значение <b>null</b>. Мы изменили только значение <b>person</b>, а не первый элемент массива, поскольку этот элемент имеет другую (скопированную) ссылку на объект. Первый элемент в <b>members</b> по-прежнему содержит ссылку на исходный объект. Когда мы выводим в консоль массив <b>members</b>, первый элемент этого массива содержит значение объекта, который и выводится в консоль."
    },
    {
        "id": 38,
        "question": "const person = {\r\n  name: &quot;John&quot;,\r\n  age: 30\r\n}\r\n\r\nfor (const item in person) {\r\n  console.log(item)\r\n}",
        "options": [
            "{ name: &quot;John&quot; } и { age: 30 }",
            "name и age",
            "John и 30",
            "[&quot;name&quot;, &quot;John&quot;] и [&quot;age&quot;, 30]"
        ],
        "correct": 1,
        "explanation": "С помощью цикла <b>for..in</b> мы перебираем ключи объекта, в данном случае <b>name</b> и <b>age</b>. Ключи объекта (кроме <b>Symbol</b>) являются строками. В каждом цикле мы устанавливаем значение <b>item</b> равным текущему ключу, по которому он перебирается. Сначала <b>item</b> равен <b>name</b>, и выводится в консоль. Затем <b>item</b> равен <b>age</b>, что также выводится в консоль."
    },
    {
        "id": 39,
        "question": "console.log(3 + 4 + &quot;5&quot;)",
        "options": [
            "&quot;345&quot;",
            "&quot;75&quot;",
            "12",
            "&quot;12&quot;"
        ],
        "correct": 1,
        "explanation": "Ассоциативность операторов - это порядок оценивания выражения движком <b>JavaScript</b>, слева направо или справа налево. Это происходит только в том случае, если все операторы имеют одинаковый приоритет. У нас есть только один тип оператора: <b>+</b>. Ассоциативность - слева направо. <b>3 + 4</b> оценивается первым. Это приводит к числу <b>7</b>. <b>7 + &quot;5&quot;</b> приводит к <b>&quot;75&quot;</b> из-за неявного приведения типов. <b>JavaScript</b> преобразует число <b>7</b> в строку. Мы можем объединять (конкатенировать) две строки с помощью оператор <b>+</b>. Выражение <b>&#39;7&#39; + &#39;5&#39;</b> возвращает <b>75</b>."
    },
    {
        "id": 40,
        "question": "const num = parseInt(&quot;7*6&quot;, 10)\r\n\r\nconsole.log(num)",
        "options": [
            "42",
            "&quot;42&quot;",
            "7",
            "NaN"
        ],
        "correct": 2,
        "explanation": "Функция <b>parseInt</b> проверяет, являются ли символы в строке допустимыми с точки зрения используемой системы счисления (второй необязательный аргумент). Как только встречается недопустимый символ, синтаксический анализ строки прекращается и последующие символы игнорируются. <b>*</b> является недопустимым числом. Поэтому <b>parseInt</b> прекращает разбор строки и возвращает <b>7</b>."
    },
    {
        "id": 41,
        "question": "const result =\r\n  [1, 2, 3].map(num =&gt; {\r\n    if (typeof num === &quot;number&quot;) return\r\n    return num * 2\r\n  })\r\n\r\nconsole.log(result)",
        "options": [
            "[]",
            "[null, null, null]",
            "[undefined, undefined, undefined]",
            "[ 3 x empty ]"
        ],
        "correct": 2,
        "explanation": "Метод <b>map</b> возвращает новый массив с обработанными с помощью функции обратного вызова элементами исходного массива. В данном случае элементы исходного массива являются числами, поэтому условие <b>if typeof num === &#39;number&#39;</b> удовлетворяется. После этого выполнение функции останавливается, в новый массив попадает значение переменной <b>num</b>, равное <b>undefined</b>."
    },
    {
        "id": 42,
        "question": "function greeting() {\r\n  throw &quot;Всем привет!&quot;\r\n}\r\n\r\nfunction sayHi() {\r\n  try {\r\n    const data = greeting()\r\n    console.log(&quot;Работает!&quot;, data)\r\n  } catch (error) {\r\n    console.log(&quot;Ошибка: &quot;, error)\r\n  }\r\n}\r\n\r\nsayHi()",
        "options": [
            "Работает! Всем привет!",
            "Ошибка: undefined",
            "ошибка",
            "Ошибка: Всем привет!"
        ],
        "correct": 3,
        "explanation": "С помощью оператора <b>throw</b> мы можем создавать собственные ошибки. Другими словами, с помощью этого оператора мы можем генерировать пользовательские исключения. Исключением может быть строка, число, логическое значение или объект. В данном случае, исключением является строка <b>Всем привет!</b>. С помощью оператора <b>catch</b> мы можем указать, что делать, если в блоке <b>try</b> возникла ошибка. Исключение - <b>Всем привет!</b>. <b>error</b> равняется этой строке. Это приводит к <b>Ошибка: Всем привет!</b>."
    },
    {
        "id": 43,
        "question": "function Car() {\r\n  this.make = &quot;Lamborghini&quot;\r\n  return { make: &quot;Maserati&quot; }\r\n}\r\n\r\nconst myCar = new Car()\r\nconsole.log(myCar.make)",
        "options": [
            "Lamborghini",
            "Maserati",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Когда возвращается свойство, его значение равняется возвращаемому значению, а не значению, установленному в функции-конструкторе. Мы возвращаем строку <b>Maserati</b>, поэтому значением <b>myCar.make</b> является <b>Maserati</b>."
    },
    {
        "id": 44,
        "question": "(() =&gt; {\r\n  let x = (y = 10)\r\n})()\r\n\r\nconsole.log(typeof x)\r\nconsole.log(typeof y)",
        "options": [
            "undefined и number",
            "number и number",
            "object и number",
            "number и undefined"
        ],
        "correct": 0,
        "explanation": "Выражение <b>let x = y = 10</b> на самом деле является сокращением для <b>y = 10; let x = y</b>. Когда мы устанавливаем <b>y</b> равным <b>10</b>, мы фактически добавляем свойство <b>y</b> к глобальному объекту (<b>window</b> в браузере, <b>global</b> в <b>Node.js</b>). В браузере <b>window.y</b> теперь равняется <b>10</b>. Затем мы объявляем переменную <b>x</b> со значением <b>y</b>. Переменные, объявленные с помощью ключевых слов <b>let</b> и <b>const</b>, имеют блочную область видимости, они доступны только в том блоке, в котором они объявлены. Таким блоком в данном случае является немедленно вызываемое функциональное выражение (Immediately Invoked Function Expression, IIFE). Когда мы используем оператор <b>typeof</b>, операнд <b>x</b> не определен: мы пытаемся получить доступ к <b>x</b> вне блока его объявления. Это означает, что <b>x</b> имеет значение <b>undefined</b>. Переменные, которым не присвоено значение, по умолчанию имеют значение <b>undefined</b>. Выражение <b>console.log(typeof x)</b> возвращает <b>undefined</b>. Однако, мы создали глобальную переменную <b>y</b>, присвоив ей значение <b>10</b>. Это значение доступно в любом месте кода. <b>y</b> определена и содержит значение типа <b>number</b>. Поэтому выражение <b>console.log(typeof y)</b> возвращает <b>number</b>."
    },
    {
        "id": 45,
        "question": "class Dog {\r\n  constructor(name) {\r\n    this.name = name\r\n  }\r\n}\r\n\r\nDog.prototype.bark = function() {\r\n  console.log(`Woof I am ${this.name}`)\r\n}\r\n\r\nconst pet = new Dog(&quot;Rex&quot;)\r\n\r\npet.bark()\r\n\r\ndelete Dog.prototype.bark\r\n\r\npet.bark()",
        "options": [
            "&quot;Woof I am Rex&quot; и &quot;&quot;",
            "&quot;Woof I am Rex&quot; и &quot;Woof I am Rex&quot;",
            "&quot;Woof I am Rex&quot; и undefined",
            "&quot;Woof I am Rex&quot; и ошибка"
        ],
        "correct": 3,
        "explanation": "Оператор <b>delete</b> позволяет удалять свойства объектов, включая свойства прототипов. Удаленное свойство прототипа становится недоступным в цепочке прототипов. Другими словами, функция <b>bark</b> после <b>delete Dog.prototype.bark</b> становится недоступной, однако мы все же пытаемся получить к ней доступ. Когда мы пытаемся вызвать нечто, не являющееся функцией, выбрасывается исключение <b>TypeError</b>: в данном случае <b>TypeError: pet.bark is not a function</b>, поскольку значением свойства <b>bark</b> объекта <b>pet</b> является <b>undefined</b>."
    },
    {
        "id": 46,
        "question": "const set = new Set([1, 1, 2, 3, 4])\r\n\r\nconsole.log(set)",
        "options": [
            "[1, 1, 2, 3, 4]",
            "[1, 2, 3, 4]",
            "{ 1, 1, 2, 3, 4 }",
            "{ 1, 2, 3, 4 }"
        ],
        "correct": 3,
        "explanation": "<b>Set</b> является коллекцией уникальных значений. Мы передаем в <b>new Set()</b> массив <b>[1, 1, 2, 3, 4]</b> с повторяющимся значением <b>1</b>. Поскольку в <b>set</b> не может быть двух одинаковых значений, одно из них удаляется. Это приводит к <b>{ 1, 2, 3, 4 }</b>."
    },
    {
        "id": 47,
        "question": "// counter.js\r\nlet counter = 10\r\nexport default counter\r\n\r\n// index.js\r\nimport myCounter from &quot;./counter.js&quot;\r\n\r\nmyCounter += 1\r\n\r\nconsole.log(myCounter)",
        "options": [
            "10",
            "11",
            "ошибка",
            "NaN"
        ],
        "correct": 2,
        "explanation": "Импортируемый модуль доступен только для чтения: мы не можем его изменять. Это можно сделать только перед экспортом. Когда мы пытаемся увеличить значение переменной <b>myCounter</b>, возникает ошибка <b>myCounter доступен только для чтения и не может быть изменен</b>."
    },
    {
        "id": 48,
        "question": "const name = &quot;John&quot;\r\nage = 30\r\n\r\nconsole.log(delete name)\r\nconsole.log(delete age)",
        "options": [
            "false и true",
            "John и 30",
            "true и true",
            "undefined и undefined"
        ],
        "correct": 0,
        "explanation": "Оператор <b>delete</b> возвращает логическое значение: <b>true</b> при успешном удалении, иначе - <b>false</b>. Однако, переменные, объявленные с помощью ключевых слов, не могут быть удалены с помощью <b>delete</b>. Переменная <b>name</b> была объявлена ​​с помощью ключевого слова <b>const</b>, поэтому возвращается <b>false</b>. Когда мы устанавливаем переменную <b>age</b> равной <b>30</b>, мы фактически добавляем свойство <b>age</b> к глобальному объекту (<b>window.age</b> в браузере, <b>global.age</b> в <b>Node.js</b>). Свойства объектов, включая глобальный, удалять можно, поэтому выражение <b>delete age</b> возвращает <b>true</b>."
    },
    {
        "id": 49,
        "question": "const numbers = [1, 2, 3, 4, 5]\r\nconst [y] = numbers\r\n\r\nconsole.log(y)",
        "options": [
            "[[1, 2, 3, 4, 5]]",
            "[1, 2, 3, 4, 5]",
            "1",
            "[1]"
        ],
        "correct": 2,
        "explanation": "Мы можем распаковывать элементы из массивов или свойства из объектов путем деструктуризации. Например:\r\n<b>[a, b] = [1, 2]</b>\r\nЗначение <b>a</b> теперь равно <b>1</b>, а значение <b>b</b> - <b>2</b>. Что мы на самом деле сделали в приведенном примере, так это:\r\n<b>[y] = [1, 2, 3, 4, 5]</b>\r\nЭто означает, что <b>y</b> равняется первому элементу массива, которым является число <b>1</b>. Поэтому в консоль выводится <b>1</b>."
    },
    {
        "id": 50,
        "question": "const user = { name: &quot;John&quot;, age: 30 }\r\nconst admin = { admin: true, ...user }\r\n\r\nconsole.log(admin)",
        "options": [
            "{ admin: true, user: { name: &quot;John&quot;, age: 30 } }",
            "{ admin: true, name: &quot;John&quot;, age: 30 }",
            "{ admin: true, user: [John, 30] }",
            "{ admin: true }"
        ],
        "correct": 1,
        "explanation": "Оператор распространения или расширения (spread, <b>...</b>) позволяет объединять объекты - создавать копии пар ключ/значение одного объекта и добавлять их в другой объект. В данном случае мы создаем копию объекта <b>user</b> и добавляем ее в объект <b>admin</b>. Объект <b>admin</b> содержит скопированные пары ключ/значение, что приводит к <b>{ admin: true, name: &#39;John&#39;, age: 30 }</b>."
    },
    {
        "id": 51,
        "question": "const person = { name: &quot;John&quot; }\r\n\r\nObject.defineProperty(person, &quot;age&quot;, { value: 30 })\r\n\r\nconsole.log(person)\r\nconsole.log(Object.keys(person))",
        "options": [
            "{ name: &quot;John&quot;, age: 30 } и [&quot;name&quot;, &quot;age&quot;]",
            "{ name: &quot;John&quot;, age: 30 } и [&quot;name&quot;]",
            "{ name: &quot;John&quot;} и [&quot;name&quot;, &quot;age&quot;]",
            "{ name: &quot;John&quot;} и [&quot;age&quot;]"
        ],
        "correct": 1,
        "explanation": "С помощью метода <b>defineProperty</b> мы можем добавлять новые свойства к объекту или изменять существующие. Когда мы добавляем свойство к объекту с помощью <b>defineProperty()</b>, они по умолчанию являются не перечисляемыми (<b>enumerable: false</b>). Метод <b>keys</b> возвращает все перечисляемые свойства объекта, в данном случае только <b>name</b>. Свойства, добавленные с помощью <b>defineProperty()</b>, по умолчанию также иммутабельны (неизменяемы, <b>writable: false</b>). Это поведение можно переопределить, используя свойства <b>writable</b>, <b>configurable</b> и <b>enumerable</b>. Таким образом, метод <b>defineProperty</b> позволяет осуществлять тонкую настройку свойств, добавляемых к объекту."
    },
    {
        "id": 52,
        "question": "const settings = {\r\n  username: &quot;johnsmith&quot;,\r\n  level: 19,\r\n  health: 88\r\n}\r\n\r\nconst data = JSON.stringify(settings, [&quot;level&quot;, &quot;health&quot;])\r\nconsole.log(data)",
        "options": [
            "{&quot;level&quot;: 19, &quot;health&quot;: 88}",
            "{&quot;username&quot;: &quot;johnsmith&quot;}",
            "[&quot;level&quot;, &quot;health&quot;]",
            "{&quot;username&quot;: &quot;johnsmith&quot;, &quot;level&quot;: 19, &quot;health&quot;: 88}"
        ],
        "correct": 0,
        "explanation": "Второй аргумент <b>JSON.stringify()</b> - это заменитель (replacer). Заменитель может быть либо функцией, либо массивом, и позволяет контролировать, что и как должно быть преобразовано в значения. Если заменитель является массивом, только свойства, указанные в нем, будут добавлены в <b>JSON-строку</b>. В данном случае в строку включаются только свойства <b>level</b> и <b>health</b>, свойство <b>username</b> исключается. Значение переменной <b>data</b> равняется <b>{ &quot;level&quot;: 19, &quot;health&quot;: 90 }</b>. Если заменитель является функцией, она вызывается для каждого свойства объекта. Значение, возвращаемое функцией, будет значением свойства при добавлении в строку. Если значением свойства является <b>undefined</b>, такое свойство исключается из состава строки."
    },
    {
        "id": 53,
        "question": "let num = 10\r\n\r\nconst increaseNumber = () =&gt; num++\r\nconst increasePassedNumber = number =&gt; number++\r\n\r\nconst num1 = increaseNumber()\r\nconst num2 = increasePassedNumber(num1)\r\n\r\nconsole.log(num1)\r\nconsole.log(num2)",
        "options": [
            "10 и 10",
            "10 и 11",
            "11 и 11",
            "11 и 12"
        ],
        "correct": 0,
        "explanation": "Постфиксный оператор <b>++</b> сначала возвращает значение операнда, затем увеличивает его. Значение переменной <b>num1</b> равняется <b>10</b>, так как функция сначала возвращает значение переменной <b>num</b> и только после этого увеличивает его на <b>1</b>. <b>num2</b> равняется <b>10</b>, так как мы передали <b>num1</b> в функцию <b>increasePassedNumber</b>. Аргумент <b>number</b> равняется <b>10</b>. Снова оператор <b>++</b> сначала возвращает значение операнда, а затем увеличивает его на <b>1</b>. Поскольку аргумент <b>number</b> равняется <b>10</b>, <b>num2</b> также равняется <b>10</b>."
    },
    {
        "id": 54,
        "question": "const value = { number: 10 }\r\n\r\nconst multiply = (x = { ...value }) =&gt; {\r\n  console.log((x.number *= 2))\r\n}\r\n\r\nmultiply()\r\nmultiply()\r\nmultiply(value)\r\nmultiply(value)",
        "options": [
            "20 40 80 160",
            "20 40 20 40",
            "20 20 20 40",
            "NaN NaN 20 40"
        ],
        "correct": 2,
        "explanation": "В <b>ES6</b> мы можем присваивать параметрам функции значения по умолчанию. Параметр будет иметь значение по умолчанию, если другое значение не было передано функции или, если значением переданного аргумента является <b>undefined</b>. В данном случае, мы распаковываем свойства объекта <b>value</b> в новый объект, поэтому значение <b>x</b> по умолчанию равняется <b>{ number: 10 }</b>. Аргумент по умолчанию реализуется в момент вызова функции. Каждый раз, когда мы вызываем функцию, создается новый объект. Мы вызываем функцию <b>multiply</b> первые два раза, не передавая ей никаких аргументов, поэтому <b>x</b> имеет значение <b>{ number: 10 }</b>. Затем мы умножаем значение <b>x.number</b> на <b>2</b>, получаем <b>20</b>. В третий раз, когда мы вызываем <b>multiply()</b>, мы передаем объект <b>value</b> в качестве. Оператор <b>*=</b> является сокращением для <b>x.number = x.number * 2</b>: мы меняем значение <b>x.number</b>, теперь оно равняется <b>20</b>. В четвертый раз мы снова передаем <b>multiply()</b> объект <b>value</b>. <b>x.number</b> равняется <b>20</b>, поэтому выражение <b>x.number *= 2</b> возвращает <b>40</b>."
    },
    {
        "id": 55,
        "question": "[1, 2, 3, 4].reduce((x, y) =&gt; console.log(x, y))",
        "options": [
            "1 2  3 3  6 4",
            "1 2  2 3  3 4",
            "1 undefined  2 undefined  3 undefined  4 undefined",
            "1 2  undefined 3  undefined 4"
        ],
        "correct": 3,
        "explanation": "Первый агрумент метода <b>reduce</b> - аккумулятор, в данном случае <b>x</b>. Второй аргумент - текущее значение, <b>y</b>. С помощью <b>reduce</b> мы применяем функцию обратного вызова к каждому элементу массива, что, в конечном счете, приводит к единственному значению. В приведенном примере мы не возвращаем никаких значений из функции, а просто регистрируем значение аккумулятора и текущее значение. Значение аккумулятора равняется ранее возвращенному значению колбека. Если методу <b>reduce</b> не передается необязательный аргумент <b>initialValue</b> (начальное значение), аккумулятор равняется первому элементу при первом вызове. При первом вызове аккумулятор (<b>x</b>) равняется <b>1</b>, а текущее значение (<b>y</b>) - <b>2</b>. Мы не выходим из функции, а регистрируем значение аккумулятора и текущее значение: <b>1</b> и <b>2</b>, соответственно. Если из функции не возвращается значения, она возвращает <b>undefined</b>. При следующем вызове аккумулятор равняется <b>undefined</b>, а текущее значение - <b>3</b>. <b>undefined</b> и <b>3</b> выводятся в консоль. При четвертом вызове мы снова не возвращаем значение из функции. Аккумулятор равняется <b>undefined</b>, а текущее значение - <b>4</b>: <b>undefined</b> и <b>4</b> выводятся в консоль."
    },
    {
        "id": 56,
        "question": "// index.js\r\nconsole.log(&#39;Выполнение index.js&#39;)\r\nimport { sum } from &#39;./sum.js&#39;\r\nconsole.log(sum(1, 2))\r\n\r\n// sum.js\r\nconsole.log(&#39;Выполнение sum.js&#39;)\r\nexport const sum = (a, b) =&gt; a + b",
        "options": [
            "Выполнение index.js  Выполнение sum.js  3",
            "Выполнение sum.js  Выполнение index.js  3",
            "Выполнение sum.js  3  Выполнение index.js",
            "Выполнение index.js  undefined  Выполнение sum.js"
        ],
        "correct": 1,
        "explanation": "При импорте модулей с помощью ключевого слова <b>import</b>, они являются предварительно разобранными (распарсенными). Это означает, что модули запускаются первыми, а код в файле, который импортирует модуль, выполняется позже. В этом разница между <b>require()</b> в <b>CommonJS</b> и <b>import()</b> в <b>ES6</b>. С помощью метода <b>require</b> мы можем загружать зависимости динамически во время выполнения кода. При использовании <b>require()</b> вместо <b>import()</b> в консоль будет выведено <b>Выполнение index.js Выполнение sum.js 3</b>."
    },
    {
        "id": 57,
        "question": "console.log(Number(2) === Number(2))\r\nconsole.log(Boolean(false) === Boolean(false))\r\nconsole.log(Symbol(&#39;foo&#39;) === Symbol(&#39;foo&#39;))",
        "options": [
            "true  true  false",
            "false  true  false",
            "true  false  true",
            "true  true  true"
        ],
        "correct": 0,
        "explanation": "&lt;p&gt;\r\nКаждый Symbol уникален. Цель аргумента, переданного Symbol, состоит в том, чтобы дать Symbol описание. Значение Symbol не зависит от переданного аргумента. Когда мы проверяем равенство, мы создаем два разных Symbol: первый Symbol(&#39;foo&#39;) и второй Symbol(&#39;foo&#39;). Эти значения уникальны и не равны друг другу, поэтому выражение &quot;Symbol(&#39;foo&#39;) === Symbol(&#39;foo&#39;)&quot; возвращает false.\r\n&lt;/p&gt;"
    },
    {
        "id": 58,
        "question": "const name = &quot;John Smith&quot;\r\nconsole.log(name.padStart(12))\r\nconsole.log(name.padStart(2))",
        "options": [
            "&quot;John Smith&quot; и &quot;John Smith&quot;",
            "&quot; John Smith&quot; и &quot; John Smith&quot; (&quot;[12x whitespace]John Smith&quot;  &quot;[2x whitespace]John Smith&quot;)",
            "&quot; John Smith&quot; и &quot;John Smith&quot; (&quot;[2x whitespace]John Smith&quot;, &quot;John Smith&quot;)",
            "&quot;John Smith&quot; и &quot;Jo&quot;"
        ],
        "correct": 2,
        "explanation": "С помощью метода <b>padStart</b> мы добавляем отступы в начало строки. Значение, передаваемое этому методу, представляет собой общую длину строки вместе с отступом. Строка <b>John Smith</b> имеет длину, равную <b>10</b>. <b>name.padStart(12)</b> вставляет <b>2</b> пробела в начало строки, потому что <b>10 + 2</b> есть <b>12</b>. Если аргумент, переданный методу <b>padStart</b>, меньше длины строки, заполнение не выполняется."
    },
    {
        "id": 59,
        "question": "console.log(&quot;📱&quot; + &quot;💻&quot;)",
        "options": [
            "&quot;📱💻&quot;",
            "257548",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "С помощью оператора <b>+</b> мы можем объединять строки. Это называется конкатенацией. В данном случае, мы объединяем строку <b>📱</b> со строкой <b>💻</b>, что приводит к <b>📱💻</b>."
    },
    {
        "id": 60,
        "question": "function* startGame() {\r\n  const answer = yield &quot;Ты любишь JavaScript?&quot;\r\n  if (answer !== &quot;Да&quot;) {\r\n    return &quot;Как интересно... В таком случае, что ты здесь делаешь?&quot;\r\n  }\r\n  return &quot;JavaScript тоже тебя любит ❤️&quot;\r\n}\r\n\r\nconst game = startGame()\r\nconsole.log(/* 1 */) // Ты любишь JavaScript?\r\nconsole.log(/* 2 */) // JavaScript тоже тебя любит ❤️",
        "options": [
            "game.next(&quot;Да&quot;).value и game.next().value",
            "game.next.value(&quot;Да&quot;) и game.next.value()",
            "game.next().value и game.next(&quot;Да&quot;).value",
            "game.next.value() и game.next.value(&quot;Да&quot;)"
        ],
        "correct": 2,
        "explanation": "Когда движок <b>JavaScript</b> встречает ключевое слово <b>yield</b>, выполнение функции-генератора приостанавливается. Во-первых, мы должны позволить функции вернуть строку <b>Ты любишь JavaScript?</b>, что можно сделать, вызвав <b>game.next().value</b>. Код функции выполняется последовательно до тех пор, пока не встретится ключевое слово <b>yield</b>. В первой строке имеется <b>yield</b>: выполнение останавливается с первым результатом. Это означает, что переменная <b>answer</b> на данный момент еще не определена. Когда мы вызываем <b>game.next(&quot;Да&quot;).value</b>, предыдущий <b>yield</b> заменяется значением аргумента, переданного методу <b>next</b>, в данном случае <b>Да</b>. Значение переменной <b>answer</b> равняется <b>Да</b>. Условие <b>if (answer !== &quot;Да&quot;)</b> возвращает <b>false</b>, и <b>JavaScript тоже тебя любит ❤️</b> выводится в консоль."
    },
    {
        "id": 61,
        "question": "console.log(String.raw`Hello\\nWorld!`)",
        "options": [
            "Hello World!",
            "Hello (на следующей строке) World!",
            "Hello\\nWorld!",
            "Hello\\n (на следующей строке) World!"
        ],
        "correct": 2,
        "explanation": "<b>String.raw()</b> возвращает строку, в которой обратные последовательности (<b>\\n, \\v, \\t</b> и т.д.) игнорируются. Иногда обратная косая черта может стать проблемой, например, такой код:\r\n<b>const path = C:\\Documents\\Projects\\table.html</b>\r\nБудет преобразован в следующее:\r\n<b>C:DocumentsProjects able.html</b>\r\n<b>String.raw()</b> игнорирует управляющие символы:\r\n<b>C:\\Documents\\Projects\\table.html</b>"
    },
    {
        "id": 62,
        "question": "async function getData() {\r\n  return await Promise.resolve(&quot;Я сделал это!&quot;)\r\n}\r\n\r\nconst data = getData()\r\nconsole.log(data)",
        "options": [
            "Я сделал это!",
            "Promise {\\&lt;resolved\\&gt;: &quot;Я сделал это!&quot;}",
            "Promise {\\&lt;pending\\&gt;}",
            "undefined"
        ],
        "correct": 2,
        "explanation": "Асинхронная функция всегда возвращает промис. <b>await</b> ожидает разрешения промиса: промис разрешается, когда мы вызываем <b>getData()</b>, чтобы присвоить его переменной <b>data</b>. Если бы мы хотели получить доступ к разрешенному значению <b>Я сделал это!</b>, мы могли бы использовать метод <b>then</b> для <b>data</b>: <b>data.then(res =&gt; console.log(res))</b>. Тогда бы мы получили <b>Я сделал это!</b>."
    },
    {
        "id": 63,
        "question": "function addToList(item, list) {\r\n  return list.push(item)\r\n}\r\n\r\nconst result = addToList(&quot;apple&quot;, [&quot;banana&quot;])\r\nconsole.log(result)",
        "options": [
            "[&#39;apple&#39;, &#39;banana&#39;]",
            "2",
            "true",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Метод <b>push</b> возвращает длину нового массива. Изначально массив содержал только один элемент (строку <b>banana</b>) и имел длину, равную <b>1</b>. После добавления в массив строки <b>apple</b>, длина массива увеличилась до <b>2</b>. Именно это значение возвращается из функции <b>addToList</b>. Метод <b>push</b> модифицирует исходный массив. Если мы хотим получить сам массив, а не его длину, из функции необходимо вернуть <b>list</b> после добавления в него <b>item</b>."
    },
    {
        "id": 64,
        "question": "const box = { x: 10, y: 20 }\r\n\r\nObject.freeze(box)\r\n\r\nconst shape = box\r\nshape.x = 100\r\n\r\nconsole.log(shape)",
        "options": [
            "{ x: 100, y: 20 }",
            "{ x: 10, y: 20 }",
            "{ x: 100 }",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "<b>Object.freeze()</b> делает невозможным добавление, удаление или изменение свойств объекта (если только значение свойства не является другим объектом). Когда мы создаем переменную <b>shape</b> и устанавливаем ее равной замороженному объекту <b>box</b>, <b>shape</b> ссылается на этот объект. Заморожен ли объект, можно определить посредством <b>Object.isFrozen()</b>. В даном случае <b>Object.isFrozen(shape)</b> вернет <b>true</b>, поскольку переменная <b>shape</b> ссылается на замороженный объект. Поскольку <b>shape</b> заморожен, а значение свойства <b>x</b> не является объектом, мы не можем его изменять. <b>x</b> по-прежнему равняется <b>10</b>, и <b>{ x: 10, y: 20 }</b> выводится в консоль."
    },
    {
        "id": 65,
        "question": "const { name: myName } = { name: &quot;John&quot; }\r\n\r\nconsole.log(name)",
        "options": [
            "John",
            "myName",
            "undefined",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Когда мы распаковываем свойство <b>name</b> из правого объекта, мы присваиваем значение <b>John</b> переменной <b>myName</b>. С помощью выражения <b>{ name: myName }</b> мы сообщаем <b>JavaScript</b>, что хотим создать новую переменную с именем <b>myName</b> и со значением свойства <b>name</b> из правой части выражения. Поскольку мы пытаемся вывести в консоль <b>name</b>, переменную, которая не определена, выбрасывается исключение <b>ReferenceError</b>."
    },
    {
        "id": 66,
        "question": "const add = () =&gt; {\r\n  const cache = {}\r\n  return num =&gt; {\r\n    if (num in cache) {\r\n      return `Из кеша! ${cache[num]}`\r\n    } else {\r\n      const result = num + 10\r\n      cache[num] = result\r\n      return `Вычислено! ${result}`\r\n    }\r\n  }\r\n}\r\n\r\nconst addFunction = add()\r\nconsole.log(addFunction(10))\r\nconsole.log(addFunction(10))\r\nconsole.log(addFunction(5 * 2))",
        "options": [
            "Вычислено! 20  Вычислено! 20  Вычислено! 20",
            "Вычислено! 20  Из кеша! 20  Вычислено! 20",
            "Вычислено! 20  Из кеша! 20  Из кеша! 20",
            "Вычислено! 20  Из кеша! 20  ошибка"
        ],
        "correct": 2,
        "explanation": "Функция <b>add</b> является функцией запоминания (мемоизации). С помощью запоминания мы можем кешировать результаты вызова функции, чтобы ускорить ее повторное выполнение. В данном случае мы создаем объект <b>cache</b> для хранения возвращаемых функцией значений. Если мы повторно вызовем функцию <b>addFunction</b> с тем же аргументом, она сначала проверит, имеется ли соответствующее значение в кеше. Если такое значение имеется, оно возвращается, что экономит время на выполнение функции. Иначе, если значение в кеше отсутствует, оно вычисляется и сохраняется. Мы вызываем <b>addFunction()</b> 3 раза с одним и тем же аргументом: при первом вызове для <b>num</b>, равном <b>10</b>, значение, возвращаемое функцией, в кеше отсутствует. Условие <b>if (num in cache)</b> возвращает <b>false</b>, и выполняется блок <b>else</b>: <b>Вычислено! 20</b> выводится в консоль, а результат добавляется в объект <b>cache</b>. <b>cache</b> теперь выглядит как <b>{ 10: 20 }</b>. При повторном вызове значение для аргумента <b>10</b> возвращается из кеша. Условие <b>if (num in cache)</b> возвращает <b>true</b>, и <b>Из кеша! 20</b> выводится в консоль. В третий раз мы передаем в функцию выражение <b>5 * 2</b>, что оценивается (вычисляется) как <b>10</b>. Объект <b>cache</b> содержит искомое значение. Условие <b>if (num in cache)</b> возвращает <b>true</b>, и <b>Из кеша! 20</b> выводится в консоль."
    },
    {
        "id": 67,
        "question": "const myLifeSummedUp = [&quot;☕&quot;, &quot;💻&quot;, &quot;🍷&quot;, &quot;🍫&quot;]\r\n\r\nfor (let item in myLifeSummedUp) {\r\n  console.log(item)\r\n}\r\n\r\nfor (let item of myLifeSummedUp) {\r\n  console.log(item)\r\n}",
        "options": [
            "0 1 2 3  &quot;☕&quot; &quot;💻&quot; &quot;🍷&quot; &quot;🍫&quot;",
            "&quot;☕&quot; &quot;💻&quot; &quot;🍷&quot; &quot;🍫&quot;  &quot;☕&quot; &quot;💻&quot; &quot;🍷&quot; &quot;🍫&quot;",
            "&quot;☕&quot; &quot;💻&quot; &quot;🍷&quot; &quot;🍫&quot;  0 1 2 3",
            "0 1 2 3  { 0: &quot;☕&quot;, 1: &quot;💻&quot;, 2: &quot;🍷&quot;, 3: &quot;🍫&quot; }"
        ],
        "correct": 0,
        "explanation": "С помощью цикла <b>for-in</b> мы перебираем перечисляемые свойства объекта. В массиве перечисляемые свойства являются &quot;ключами&quot; элементов массива, которые фактически являются их индексами. Вы можете представить массив как: <b>{0: &quot;☕&quot;, 1: &quot;💻&quot;, 2: &quot;🍷&quot;, 3: &quot;🍫&quot;}</b>, где ключи - перечисляемые свойства. <b>0 1 2 3</b> выводится в консоль.\r\nС помощью цикла <b>for-of</b> мы перебираем значения итерируемых сущностей (сущностей, поддающихся перебору). Массив является итерируемой сущностью. Когда мы выполняем итерацию по массиву, переменная <b>item</b> равняется итерируемому элементу, <b>&quot;☕&quot; &quot;💻&quot; &quot;🍷&quot; &quot;🍫&quot;</b> выводится в консоль."
    },
    {
        "id": 68,
        "question": "const list = [1 + 2, 1 * 2, 1 / 2]\r\nconsole.log(list)",
        "options": [
            "[&quot;1 + 2&quot;, &quot;1 * 2&quot;, &quot;1 / 2&quot;]",
            "[&quot;12&quot;, 2, 0.5]",
            "[3, 2, 0.5]",
            "[1, 1, 1]"
        ],
        "correct": 2,
        "explanation": "Элементами массива могут быть любые типы данных. Числа, строки, объекты, другие массивы, <b>null</b>, логические значения, <b>undefined</b>, а также даты, функции и выражения. Элемент будет равен возвращаемому значению. Выражение <b>1 + 2</b> возвращает <b>3</b>, <b>1 * 2</b> - <b>2</b>, а <b>1 / 2</b> - <b>0.5</b>."
    },
    {
        "id": 69,
        "question": "function sayHi(name) {\r\n  return `Hello, ${name}`\r\n}\r\n\r\nconsole.log(sayHi())",
        "options": [
            "Hello,",
            "Hello, undefined",
            "Hello, null",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "По умолчанию аргументы функции имеют значение <b>undefined</b>, если значение не было передано при вызове функции или присвоено по умолчанию. В данном случае мы не передаем значения для аргумента <b>name</b>. <b>name</b> равняется <b>undefined</b>. В <b>ES6</b> мы можем перезаписывать <b>undefined</b> значениями по умолчанию. Например: <b>function sayHi(name = &quot;John&quot;) { ... }</b>. В данном случае, если мы не передали значение или передали <b>undefined</b>, аргумент <b>name</b> будет иметь значение <b>John</b>."
    },
    {
        "id": 70,
        "question": "var status = &quot;😎&quot;\r\n\r\nsetTimeout(() =&gt; {\r\n  const status = &quot;😍&quot;\r\n\r\n  const data = {\r\n    status: &quot;😉&quot;,\r\n    getStatus() {\r\n      return this.status\r\n    }\r\n  }\r\n\r\n  console.log(data.getStatus())\r\n  console.log(data.getStatus.call(this))\r\n}, 0)",
        "options": [
            "&quot;😉&quot;  &quot;😍&quot;",
            "&quot;😉&quot;  &quot;😎&quot;",
            "&quot;😍&quot;  &quot;😎&quot;",
            "&quot;😎&quot;  &quot;😎&quot;"
        ],
        "correct": 1,
        "explanation": "Значение ключевого слова <b>this</b> зависит от того, в каком контексте оно используется. В методе <b>getStatus</b> <b>this</b> указывает на объект, которому принадлежит метод. Метод принадлежит объекту <b>data</b>, поэтому <b>this</b> указывает на этот объект. Когда мы выводим в консоль <b>this.status</b>, выводится свойство <b>status</b> объекта <b>data</b> или <b>😉</b>. С помощью метода <b>call</b> мы можем изменить объект, на который ссылается <b>this</b> (изменить контекст <b>this</b>). В функциях ключевое слово <b>this</b> относится к объекту, которому принадлежит функция, либо к объекту, создаваемому с помощью функции-конструктора. Мы объявили функцию <b>setTimeout</b> для объекта <b>global</b>, поэтому в функции <b>setTimeout</b> ключевое слово <b>this</b> указывает на объект <b>global</b>. В глобальном объекте есть переменная <b>status</b> со значением <b>😎</b>, которое и выводится в консоль."
    },
    {
        "id": 71,
        "question": "const person = {\r\n  name: &quot;John&quot;,\r\n  age: 30\r\n}\r\n\r\nlet city = person.city\r\ncity = &quot;New York&quot;\r\n\r\nconsole.log(person)",
        "options": [
            "{ name: &quot;John&quot;, age: 30 }",
            "{ name: &quot;John&quot;, age: 30, city: &quot;New York&quot; }",
            "{ name: &quot;John&quot;, age: 30, city: undefined }",
            "New York"
        ],
        "correct": 0,
        "explanation": "Мы устанавливаем переменную <b>city</b> равной значению свойства <b>city</b> объекта <b>person</b>. У этого объекта нет свойства <b>city</b>, поэтому переменная <b>city</b> имеет значение <b>undefined</b>. Обратите внимание, что мы не ссылаемся на <b>person</b>. Мы просто устанавливаем переменную <b>city</b> равной текущему значению свойства <b>city</b> объекта <b>person</b>. Затем мы устанавливаем переменную <b>city</b> равной строке <b>New York</b>. Это не изменяет объект <b>person</b>."
    },
    {
        "id": 72,
        "question": "function checkAge(age) {\r\n  if (age &lt; 18) {\r\n    const message = &quot;Ты слишком молод.&quot;\r\n  } else {\r\n    const message = &quot;Ты достаточно взрослый!&quot;\r\n  }\r\n  return message\r\n}\r\n\r\nconsole.log(checkAge(30))",
        "options": [
            "&quot;Ты слишком молод.&quot;",
            "&quot;Ты достаточно взрослый!&quot;",
            "ошибка",
            "undefined"
        ],
        "correct": 2,
        "explanation": "Переменные, объявленные с помощью ключевых слов <b>const</b> и <b>let</b>, имеют блочную область видимости. Блок - это любой код между фигурными скобками (<b>{}</b>) - в данном случае в фигурных скобках операторов <b>if-else</b>. Мы не можем получить доступ к переменной за пределами блока, в котором она объявлена - выбрасывается исключение <b>ReferenceError</b>."
    },
    {
        "id": 73,
        "question": "function getName(name) {\r\n  const hasName = /* ? */\r\n}",
        "options": [
            "!!name",
            "name",
            "new Boolean(name)",
            "name.length"
        ],
        "correct": 0,
        "explanation": "С помощью выражения <b>!!name</b> мы определяем, является ли значение аргумента <b>name</b> истинным. Если <b>name</b> равняется <b>true</b>, то <b>!name</b> возвращает <b>false</b>. А <b>!false</b> (это то, чем на самом деле является <b>!!name</b>) возвращает <b>true</b>. Устанавливая <b>hasName</b> равным <b>name</b>, мы устанавливаем <b>hasName</b> равным любому значению, которое передается функции <b>getName</b>, а не логическому значению <b>true</b>. <b>new Boolean(true)</b> возвращает объектную обертку, а не само логическое значение. <b>name.length</b> возвращает длину переданного аргумента."
    },
    {
        "id": 74,
        "question": "console.log(&quot;Я хочу пиццу!&quot;[0])",
        "options": [
            "&quot;&quot;",
            "&quot;Я&quot;",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Чтобы получить символ по определенному индексу из строки, мы можем использовать скобочную нотацию. Первый символ в строке имеет индекс <b>0</b>, второй - индекс <b>1</b> и т.д. В данном случае мы хотим получить элемент с индексом <b>0</b>, символ <b>Я</b>, который и выводится в консоль. Альтернативой получения символа по индексу является метод <b>charAt</b>."
    },
    {
        "id": 75,
        "question": "function sum(num1, num2 = num1) {\r\n  console.log(num1 + num2)\r\n}\r\n\r\nsum(10)",
        "options": [
            "NaN",
            "20",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Мы можем установить значение параметра по умолчанию равным другому параметру функции, если такой параметр был определен до параметра по умолчанию. Мы передаем значение <b>10</b> функции <b>sum</b>. Если <b>sum()</b> получает только один аргумент, значит, значение для <b>num2</b> не передано, ей присваивается значение по умолчанию, т.е. <b>10</b>. Выражение <b>num1 + num2</b> возвращает <b>20</b>. Если попытаться установить значение параметра по умолчанию равным параметру, который определяется позже, то возникнет ошибка."
    },
    {
        "id": 76,
        "question": "// module.js\r\nexport default () =&gt; &quot;Hello World!&quot;\r\nexport const name = &quot;John&quot;\r\n\r\n// index.js\r\nimport * as data from &quot;./module&quot;\r\n\r\nconsole.log(data)",
        "options": [
            "{ default: function default(), name: &quot;John&quot; }",
            "{ default: function default() }",
            "{ default: &quot;Hello World!&quot;, name: &quot;John&quot; }",
            "глобальный объект module.js"
        ],
        "correct": 0,
        "explanation": "С помощью <b>import * as name</b> мы импортируем все экспорты из файла <b>module.js</b> в файл <b>index.js</b>, создается новый объект <b>data</b>. В файле <b>module.js</b> имеется два экспорта: экспорт по умолчанию и именованный экспорт. Экспорт по умолчанию - это функция, которая возвращает строку <b>Hello World!</b>, а именованный экспорт - это переменная <b>nam</b>&quot;, которая имеет значение <b>John</b>. Объект <b>data</b> имеет свойство <b>default</b> для экспорта по умолчанию, другие свойства - именованные экспорты и соответствующие значения."
    },
    {
        "id": 77,
        "question": "class Person {\r\n  constructor(name) {\r\n    this.name = name\r\n  }\r\n}\r\n\r\nconst member = new Person(&quot;John&quot;)\r\nconsole.log(typeof member)",
        "options": [
            "class",
            "function",
            "object",
            "string"
        ],
        "correct": 2,
        "explanation": "Классы являются синтаксическим сахаром для функций-конструкторов. Эквивалентом класса <b>Person</b> в качестве функции-конструктора будет <b>function Person() { this.name = name }</b>. Вызов функции-конструктора с ключевым словом <b>new</b> приводит к созданию нового экземпляра объекта <b>Person</b>. Выражение <b>typeof member</b> возвращает <b>object</b>."
    },
    {
        "id": 78,
        "question": "let newList = [1, 2, 3].push(4)\r\n\r\nconsole.log(newList.push(5))",
        "options": [
            "[1, 2, 3, 4, 5]",
            "[1, 2, 3, 5]",
            "[1, 2, 3, 4]",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Метод <b>push</b> возвращает длину нового массива, а не сам массив. Устанавливая <b>newList</b> равным <b>[1, 2, 3].push(4)</b>, мы устанавливаем <b>newList</b> равным <b>4</b>. Затем мы пытаемся использовать метод <b>push</b> для <b>newList</b>. Поскольку <b>newList</b> является числом <b>4</b>, мы не можем использовать <b>push</b> - выбрасывается исключение <b>TypeError</b>."
    },
    {
        "id": 79,
        "question": "function giveMePizza() {\r\n  return &quot;А вот и пицца!&quot;\r\n}\r\n\r\nconst giveMeChocolate = () =&gt; &quot;Вот шоколад... теперь дуй в тренажерку.&quot;\r\n\r\nconsole.log(giveMePizza.prototype)\r\nconsole.log(giveMeChocolate.prototype)",
        "options": [
            "{ constructor: ...} { constructor: ...}",
            "{} { constructor: ...}",
            "{ constructor: ...} {}",
            "{ constructor: ...} undefined"
        ],
        "correct": 3,
        "explanation": "Обычные функции, такие как <b>giveMePizza</b>, имеют свойство <b>prototype</b>, которое является объектом (прототипом объекта) со свойством <b>constructor</b>. Однако стрелочные функции, такие как <b>giveMeChocolate</b>, не имеют прототипа. Поэтому при попытке получить доступ к <b>giveMeChocolate.prototype</b> возвращается <b>undefined</b>."
    },
    {
        "id": 80,
        "question": "const person = {\r\n  name: &quot;John&quot;,\r\n  age: 30\r\n}\r\n\r\nfor (const [x, y] of Object.entries(person)) {\r\n  console.log(x, y)\r\n}",
        "options": [
            "name John и age 30",
            "[&quot;name&quot;, &quot;John&quot;] и [&quot;age&quot;, 30]",
            "[&quot;name&quot;, &quot;age&quot;] и undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "<b>Object.entries(person)</b> возвращает массив вложенных массивов, содержащий ключи и значения: <b>[ [ &#39;name&#39;, &#39;John&#39; ], [ &#39;age&#39;, 30 ] ]</b>.\r\nС помощью цикла <b>for-of</b> мы перебираем элементы массива - в данном случае подмассивы. Мы можем деструктурировать подмассивы в цикле, используя <b>const [x, y]</b>. <b>x</b> равняется первому элементу в подмассиве, <b>y</b> - второму. Первым подмассивом является <b>[ &quot;name&quot;, &quot;John&quot; ]</b>, где <b>x</b> равняется <b>name</b>, а <b>y</b> - <b>John</b>. Вторым подмассивом является <b>[ &quot;age&quot;, 30 ]</b>, где <b>x</b> равняется <b>age</b>, а <b>y</b> - <b>30</b>."
    },
    {
        "id": 81,
        "question": "function getItems(fruitList, ...args, favoriteFruit) {\r\n  return [...fruitList, ...args, favoriteFruit]\r\n}\r\n\r\nconsole.log(getItems([&quot;banana&quot;, &quot;apple&quot;], &quot;pear&quot;, &quot;orange&quot;))",
        "options": [
            "[&quot;banana&quot;, &quot;apple&quot;, &quot;pear&quot;, &quot;orange&quot;]",
            "[ [&quot;banana&quot;, &quot;apple&quot;], &quot;pear&quot;, &quot;orange&quot; ]",
            "[&quot;banana&quot;, &quot;apple&quot;, [&quot;pear&quot;], &quot;orange&quot;]",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "<b>...args</b> - это прочие параметры (оператор rest). Значение прочих параметров - это массив, содержащий неиспользованные аргументы и в этой связи передаваемый последним. В приведенном примере <b>rest</b> является вторым аргументом. Это приводит к синтаксической ошибке.\r\n\r\nfunction getItems(fruitList, favoriteFruit, ...args) {\r\n  return [...fruitList, ...args, favoriteFruit]\r\n}\r\ngetItems([&quot;banana&quot;, &quot;apple&quot;], &quot;pear&quot;, &quot;orange&quot;)\r\n\r\nДанный код работает, как ожидается, и возвращает массив <b>[ &#39;banana&#39;, &#39;apple&#39;, &#39;orange&#39;, &#39;pear&#39; ]</b>."
    },
    {
        "id": 82,
        "question": "function nums(a, b) {\r\n  if\r\n    (a &gt; b)\r\n    console.log(&#39;a больше&#39;)\r\n  else\r\n    console.log(&#39;b больше&#39;)\r\n    return\r\n  a + b\r\n}\r\n\r\nconsole.log(nums(4, 2))\r\nconsole.log(nums(1, 2))",
        "options": [
            "a больше, 6 и b больше, 3",
            "a больше, undefined и b больше, undefined",
            "undefined и undefined",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "В <b>JavaScript</b> мы не обязаны явно указывать точку с запятой (<b>;</b>), однако, интерпретатор автоматически добавляет их после операторов. Оператором могут быть переменные или ключевые слова, такие как <b>throw</b>, <b>return</b>, <b>break</b> и др. В приведенном примере имеется оператор <b>return</b> и выражение <b>a + b</b> на новой строке. Поскольку это новая строка, движок не знает, что это значение, которое мы хотим вернуть. Он автоматически добавляет точку с запятой после <b>return</b>. Это выглядит так: <b>return; a + b</b>.\r\nЭто означает, что строка <b>a + b</b> никогда не достигается, функция возвращает управление после ключевого слова <b>return</b>. Если значение не возвращается явно, как в приведенном примере, функция возвращает <b>undefined</b>. Обратите внимание, что после операторов <b>if-else</b> точки с запятой автоматически не вставляются."
    },
    {
        "id": 83,
        "question": "class Person {\r\n  constructor() {\r\n    this.name = &quot;John&quot;\r\n  }\r\n}\r\n\r\nPerson = class AnotherPerson {\r\n  constructor() {\r\n    this.name = &quot;Jane&quot;\r\n  }\r\n}\r\n\r\nconst member = new Person()\r\nconsole.log(member.name)",
        "options": [
            "John",
            "Jane",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Мы можем установить классы равными другим классам/функциям-конструкторам. В данном случае мы устанавливаем класс <b>Person</b> равным классу <b>AnotherPerson</b>. Свойство <b>name</b> этого конструктора имеет значение <b>Jane</b>, поэтому свойство <b>name</b> для нового экземпляра класса <b>Person</b> <b>member</b> - это также <b>Jane</b>."
    },
    {
        "id": 84,
        "question": "const info = {\r\n  [Symbol(&quot;a&quot;)]: &quot;b&quot;\r\n}\r\n\r\nconsole.log(info)\r\nconsole.log(Object.keys(info))",
        "options": [
            "{ Symbol(&#39;a&#39;): &#39;b&#39; } и [&quot;{Symbol(&#39;a&#39;)&quot;]",
            "{} и []",
            "{ a: &#39;b&#39; } и [&#39;a&#39;]",
            "{ Symbol(&#39;a&#39;): &#39;b&#39; } и []"
        ],
        "correct": 3,
        "explanation": "<b>Symbol</b> не является перечисляемым (<b>enumerable: false</b>). Метод <b>keys</b> возвращает все перечисляемые ключи объекта. <b>Symbol</b> не просматривается таким способом, поэтому возвращается пустой массив. При выводе в консоль объекта будут видны все его свойства, даже не перечисляемые. Это одно из качеств символа: помимо представления совершенно уникального значения (которое предотвращает случайное пересечение имен в объектах, например, при работе с 2 библиотеками, которые хотят добавить свойства с одинаковыми именами к одному и тому же объекту). Мы также можем &quot;скрыть&quot; свойства объектов таким способом (хотя и не полностью: мы можем получить доступ к символам с помощью <b>Object.getOwnPropertySymbols()</b>)."
    },
    {
        "id": 85,
        "question": "const getList = ([x, ...y]) =&gt; [x, y]\r\nconst getUser = user =&gt; { name: user.name; age: user.age }\r\n\r\nconst list = [1, 2, 3, 4]\r\nconst user = { name: &quot;John&quot;, age: 30 }\r\n\r\nconsole.log(getList(list))\r\nconsole.log(getUser(user))",
        "options": [
            "[1, [2, 3, 4]] и undefined",
            "[1, [2, 3, 4]] и { name: &quot;John&quot;, age: 30 }",
            "[1, 2, 3, 4] и { name: &quot;John&quot;, age: 30 }",
            "null и { name: &quot;John&quot;, age: 30 }"
        ],
        "correct": 0,
        "explanation": "Функция <b>getList</b> принимает массив в качестве аргумента. В <b>getList()</b> мы деструктурируем этот массив. Это выглядит так: <b>[x, ...y] = [1, 2, 3, 4]</b>.\r\nС помощью rest-оператора <b>...y</b> мы помещаем прочие аргументы (все аргументы, кроме первого) в массив. Такими аргументами являются <b>2, 3 и 4</b>. Значением переменной <b>y</b> является массив, содержащий прочие параметры. В данном случае значение <b>x</b> равно <b>1</b>, поэтому, в консоль попадает <b>[x, y]</b>, т.е. <b>[1, [2, 3, 4]]</b>.\r\nФункция <b>getUser</b> в качестве аргумента принимает нечто, похожее на объект (обратите внимание, что свойства &quot;объекта&quot; разделяются <b>;</b>, а не <b>,</b>). В случае стрелочных функций мы можем обойтись без фигурных скобок, если возвращаем только одно значение. Однако, если мы хотим вернуть объект из стрелочной функции, то должны указать его в круглых скобках, в противном случае, при разборе кода, когда движок встретит <b>,</b> будет выброшено исключение <b>SyntaxError</b>. Такая функция вернула бы объект: <b>const getUser = user =&gt; ({ name: user.name, age: user.age })</b>.\r\nПоскольку &quot;свойства&quot; разделены <b>;</b> и отсутствует оператор <b>return</b>, функция возвращает <b>undefined</b>."
    },
    {
        "id": 86,
        "question": "const name = &quot;John&quot;\r\n\r\nconsole.log(name())",
        "options": [
            "SyntaxError",
            "ReferenceError",
            "TypeError",
            "undefined"
        ],
        "correct": 2,
        "explanation": "Переменная <b>name</b> содержит строку, которая не является функцией, поэтому не может быть вызвана. <b>TypeError</b> возникает, когда значение не соответствует ожидаемому типу. Движок <b>JavaScript</b> ожидает, что значением переменной <b>name</b> является функция, так как мы пытаемся ее вызвать. Однако, значением <b>name</b> является строка, поэтому выбрасывается исключение <b>TypeError: name is not a function</b> (<b>name</b> не является функцией). <b>SyntaxError</b> генерируются, когда мы написали нечто недопустимое с точки зрения <b>JavaScript</b>, например, когда ключевое слово <b>return</b> написано как <b>retrun</b>. <b>ReferenceError</b> генерируются, когда <b>JavaScript</b> не может найти ссылку на значение, к которому мы обращаемся."
    },
    {
        "id": 87,
        "question": "const one = (false || {} || null)\r\nconst two = (null || false || &quot;&quot;)\r\nconst three = ([] || 0 || true)\r\n\r\nconsole.log(one, two, three)",
        "options": [
            "false null []",
            "null &quot;&quot; true",
            "{} &quot;&quot; []",
            "null null true"
        ],
        "correct": 2,
        "explanation": "Оператор <b>||</b> (логическое <b>ИЛИ</b>) возвращает первый истинный операнд. Если все значения ложны, возвращается последний операнд. <b>(false || {} || null)</b>: пустой объект (<b>{}</b>) является истинным значением. Это первое (и единственное) истинное значение, которое и возвращается. Переменная <b>one</b> имеет значение <b>{}</b>. <b>(null || false ||&quot;&quot;)</b>: все операнды являются ложными. Это означает, что возвращается последний операнд - пустая строка (<b>&quot;&quot;</b>). Переменная <b>two</b> имеет значение <b>&quot;&quot;</b>. <b>([] || 0 || true)</b>: пустой массив (<b>[]</b>) является истинным значением. Это первое истинное значение, которое и возвращается. Переменная <b>three</b> имеет значение <b>[]</b>."
    },
    {
        "id": 88,
        "question": "const myPromise = () =&gt; Promise.resolve(&#39;I have resolved!&#39;)\r\n\r\nfunction firstFunction() {\r\n  myPromise().then(res =&gt; console.log(res))\r\n  console.log(&#39;first&#39;)\r\n}\r\n\r\nasync function secondFunction() {\r\n  console.log(await myPromise())\r\n  console.log(&#39;second&#39;)\r\n}\r\n\r\nfirstFunction()\r\nsecondFunction()",
        "options": [
            "I have resolved! first и I have resolved! second",
            "first I have resolved! и second I have resolved!",
            "I have resolved! second и first I have resolved!",
            "first I have resolved! и I have resolved! second"
        ],
        "correct": 3,
        "explanation": "С промисами дело обстоит следующим образом: &quot;Я хочу отложить выполнение этой функции, поскольку это может занять некоторое время&quot; (promise переводится как &quot;обещание&quot;). Только когда промис выполнен или отклонен (разрешен), и когда стек вызовов (call stack) пуст, я хочу получить возвращаемое им значение. Мы можем получить значение с помощью ключевого слова <b>then</b> или <b>await</b> в асинхронной функции. Эти ключевые слова работают по-разному. В <b>firstFunction()</b> мы (вроде бы) приостановили выполнение функции <b>myPromise</b>, и продолжили выполнение другого кода, в данном случае <b>console.log(&#39;first&#39;)</b>. Затем функция разрешается строкой <b>I have resolved!</b>, которая выводится в консоль после освобождения стека вызовов. С помощью ключевого слова <b>await</b> в <b>secondFunction()</b> мы приостанавливаем выполнение асинхронной функции до тех пор, пока промис не будет разрешен. Это означает, что мы ожидаем разрешения <b>myPromise()</b> со значением <b>I have resolved!</b>, и только после того, как это произошло, мы переходим к следующей строке. Поэтому строка <b>second</b> выводится в консоль последней."
    },
    {
        "id": 89,
        "question": "const set = new Set()\r\n\r\nset.add(1)\r\nset.add(&quot;John&quot;)\r\nset.add({ name: &quot;John&quot; })\r\n\r\nfor (let item of set) {\r\n  console.log(item + 2)\r\n}",
        "options": [
            "3 NaN NaN",
            "3 7 NaN",
            "3 John2 [object Object]2",
            "&quot;12&quot; John2 [object Object]2"
        ],
        "correct": 2,
        "explanation": "Оператор <b>+</b> используется не только для сложения чисел, но и для объединения (конкатенации) строк. Всякий раз, когда движок <b>JavaScript</b> видит, что одно или несколько значений не являются числом, он приводит число к строке. Первым значением является <b>1</b> - число. Выражение <b>1 + 2</b> возвращает <b>3</b>. Вторым значением является <b>John</b>. <b>John</b> является строкой, а <b>2</b> - числом: <b>2</b> приводится к строке. <b>John</b> и <b>2</b> объединяются, что приводит к <b>John2</b>. <b>{ name: &quot;John&quot; }</b> является объектом. Ни число, ни объект не являются строкой, поэтому они приводятся к строке. Когда объект приводится к строке он превращается в <b>[object Object]</b>. <b>[object Object]</b>, объединенный с <b>2</b>, становится <b>[object Object]2</b>."
    },
    {
        "id": 90,
        "question": "console.log(Promise.resolve(5))",
        "options": [
            "5",
            "`Promise {&lt;pending&gt;: 5}`",
            "`Promise {&lt;resolved&gt;: 5}`",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "Мы можем передавать в <b>Promise.resolve()</b> любой тип данных. Данный метод возвращает промис с разрешенным значением. Если мы передадим ему обычную функцию, промис разрешится с обычным значением. Если мы передадим промис, промис разрешится с разрешенным значением переданного промиса. В данном случае мы передаем <b>Promise.resolve()</b> число <b>5</b>. Поэтому возвращается разрешенный промис со значением <b>5</b>."
    },
    {
        "id": 91,
        "question": "function compareMembers(person1, person2 = person) {\r\n  if (person1 !== person2) {\r\n    console.log(&quot;Не одинаковые!&quot;)\r\n  } else {\r\n    console.log(&quot;Одинаковые!&quot;)\r\n  }\r\n}\r\n\r\nconst person = { name: &quot;Игорь&quot; }\r\n\r\ncompareMembers(person)",
        "options": [
            "Не одинаковые!",
            "Одинаковые!",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Объекты в <b>JavaScript</b> передаются по ссылке. Когда мы проверяем объекты на строгое равенство (идентичность) с помощью оператора <b>===</b>, мы сравниваем их ссылки. Мы устанавливаем значение по умолчанию для параметра <b>person2</b>, равное объекту <b>person</b>, и передаем объект <b>person</b> в качестве значения для параметра <b>person1</b>. Это означает, что оба параметра содержат ссылку на одно и то же место в памяти, поэтому они равны. Выполняется код в блоке <b>else</b>, и в консоль выводится <b>Одинаковые!</b>."
    },
    {
        "id": 92,
        "question": "const colorConfig = {\r\n  red: true,\r\n  blue: false,\r\n  green: true,\r\n  black: true,\r\n  yellow: false,\r\n}\r\n\r\nconst colors = [&quot;pink&quot;, &quot;red&quot;, &quot;blue&quot;]\r\n\r\nconsole.log(colorConfig.colors[1])",
        "options": [
            "true",
            "false",
            "undefined",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "В <b>JavaScript</b> у нас есть два способа получить доступ к свойствам объекта: скобочная нотация и точечная нотация. В данном случае, мы используем точечную нотацию (<b>colorConfig.colors</b>) вместо скобочной (<b>colorConfig[&quot;colors&quot;]</b>). При точечной нотации движок пытается найти свойство объекта с указанным именем. В приведенном примере <b>JavaScript</b> пытается найти свойство <b>colors</b> в объекте <b>colorConfig</b>. Такого свойства не существует, поэтому возвращается <b>undefined</b>. Затем мы пытаемся получить доступ к значению первого элемента массива, используя <b>[1]</b>. Мы не можем сделать этого для <b>undefined</b>, поэтому выбрасывается исключение <b>TypeError: Cannot read property &#39;1&#39; of undefined</b>. <b>JavaScript</b> интерпретирует (распаковывает) операторы. Когда мы используем скобочную нотацию, <b>JavaScript</b> видит открывающуюся скобку (<b>[</b>) и продолжает разбирать код, пока не встретит закрывающуюся скобку (<b>]</b>). Только после этого выражение оценивается. Если бы мы использовали <b>colorConfig[colors[1]]</b>, то вернулось бы значение свойства <b>red</b> объекта <b>colorConfig</b>."
    },
    {
        "id": 93,
        "question": "console.log(&#39;❤️&#39; === &#39;❤️&#39;)",
        "options": [
            "true",
            "false",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "Смайлики - это юникоды. Юникод для сердца - <b>U+2764 U+FE0F</b>. Юникоды одинаковы для одних и тех же смайликов. Таким образом, мы сравниваем две одинаковые строки, поэтому возвращается <b>true</b>."
    },
    {
        "id": 94,
        "question": "const food = [&#39;🍕&#39;, &#39;🍫&#39;, &#39;🍳&#39;, &#39;🍔&#39;]\r\nconst info = { favoriteFood: food[0] }\r\n\r\ninfo.favoriteFood = &#39;🍝&#39;\r\n\r\nconsole.log(food)",
        "options": [
            "[&#39;🍕&#39;, &#39;🍫&#39;, &#39;🍳&#39;, &#39;🍔&#39;]",
            "[&#39;🍝&#39;, &#39;🍫&#39;, &#39;🍳&#39;, &#39;🍔&#39;]",
            "[&#39;🍝&#39;, &#39;🍕&#39;, &#39;🍫&#39;, &#39;🍳&#39;, &#39;🍔&#39;]",
            "undefined"
        ],
        "correct": 0,
        "explanation": "Мы устанавливаем значение свойства <b>favourFood</b> объекта <b>info</b> равным строке <b>🍕</b>. Строка является примитивным типом данных. В <b>JavaScript</b> примитивные типы данных (все, что не является объектом) передаются по значению. Затем мы меняем значение свойства <b>favourFood</b>. Массив <b>food</b> не изменился, поскольку значение <b>favourFood</b> было скопировано из значения первого элемента в массиве и не имеет ссылки на то же место в памяти, что и <b>food[0]</b>. Поэтому в консоль выводится исходный массив <b>[&#39;🍕&#39;, &#39;🍫&#39;, &#39;🍳&#39;, &#39;🍔&#39;]</b>."
    },
    {
        "id": 95,
        "question": "let name = &#39;John&#39;\r\n\r\nfunction getName() {\r\n  console.log(name)\r\n  let name = &#39;Jane&#39;\r\n}\r\n\r\ngetName()",
        "options": [
            "John",
            "Jane",
            "undefined",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Каждая функция имеет собственный контекст выполнения (или область видимости). Функция <b>getName</b> сначала ищет переменную <b>name</b> в собственном контексте (области видимости). <b>getName()</b> содержит переменную <b>name</b>: мы объявляем переменную <b>name</b> с помощью ключевого слова <b>let</b> и присваиваем ей значение <b>Jane</b>. Переменные, объявленные с помощью ключевых слов <b>let</b> и <b>const</b> не поднимаются в начало области видимости (в данном случае функции), в отличие от переменных, объявленных с помощью ключевого слова <b>var</b>. Они недоступны до инициализации (присваивания им значения). Это называется &quot;временной мертвой зоной&quot;. Когда мы пытаемся получить доступ к таким переменным, <b>JavaScript</b> выбрасывает исключение <b>ReferenceError</b>. Если бы мы не объявили переменную <b>name</b> в функции <b>getName</b>, движок продолжал бы поиск переменной по цепочке областей видимости. Внешняя область видимости содержит переменную <b>name</b> со значением <b>John</b>. В этом случае в консоль было бы выведено <b>John</b>."
    },
    {
        "id": 96,
        "question": "function* generatorOne() {\r\n  yield [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]\r\n}\r\n\r\nfunction* generatorTwo() {\r\n  yield* [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]\r\n}\r\n\r\nconst one = generatorOne()\r\nconst two = generatorTwo()\r\n\r\nconsole.log(one.next().value)\r\nconsole.log(two.next().value)",
        "options": [
            "a  a",
            "a  undefined",
            "[&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]  a",
            "a  [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]"
        ],
        "correct": 2,
        "explanation": "С помощью ключевого слова <b>yield</b> мы получаем значения в функциях-генераторах. С помощью <b>yield*</b> мы можем получить значение из другой функции-генератора или итерируемого объекта (например, массива). В <b>generatorOne()</b> мы получаем весь массив <b>[&#39; a &#39;,&#39; b &#39;,&#39; c &#39;]</b>, используя <b>yield</b>. Значение свойства <b>value</b>, возвращаемого методом <b>next</b> объекта <b>one</b> (<b>one.next().value</b>), равняется массиву <b>[&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]</b>.\r\n\r\nconsole.log(one.next().value) // [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]\r\nconsole.log(one.next().value) // undefined\r\n\r\nВ функции <b>generatorTwo</b> мы используем ключевое слово <b>yield*</b>. Это означает, что первое значение равняется первому значению итератора. Итератор - это массив <b>[&#39;a&#39;, &#39;b&#39;, &#39;c&#39;]</b>. Первым значением этого массива является <b>a</b>, поэтому когда мы вызываем <b>two.next().value</b>, возвращается <b>a</b>.\r\n\r\nconsole.log(two.next().value) // &#39;a&#39;\r\nconsole.log(two.next().value) // &#39;b&#39;\r\nconsole.log(two.next().value) // &#39;c&#39;\r\nconsole.log(two.next().value) // undefined"
    },
    {
        "id": 97,
        "question": "console.log(`${(x =&gt; x)(&#39;Я люблю&#39;)} писать код`)",
        "options": [
            "Я люблю писать код",
            "undefined писать код",
            "${(x =&gt; x)(&#39;Я люблю&#39;) писать код",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "Выражения внутри шаблонных литералов оцениваются первыми. Это означает, что строка будет содержать значение выражения - в данном случае значение немедленно вызываемого функционального выражения (IIFE) <b>(x =&gt; x)(&#39;Я люблю&#39;)</b>. Мы передаем значение <b>Я люблю</b> в качестве аргумента стрелочной функции <b>x =&gt; x</b>. Аргумент <b>x</b> имеет значение <b>Я люблю</b>, которое и возвращается. Это приводит к <b>Я люблю писать код</b>."
    },
    {
        "id": 98,
        "question": "const person = {\r\n  name: &quot;John&quot;,\r\n  age: 29\r\n}\r\n\r\nconst changeAge = (x = { ...person }) =&gt; x.age += 1\r\nconst changeAgeAndName = (x = { ...person }) =&gt; {\r\n  x.age += 1\r\n  x.name = &quot;Jane&quot;\r\n}\r\n\r\nchangeAge(person)\r\nchangeAgeAndName()\r\n\r\nconsole.log(person)",
        "options": [
            "{ name: &quot;Jane&quot;, age: 30 }",
            "{ name: &quot;Jane&quot;, age: 31 }",
            "{ name: &quot;John&quot;, age: 30 }",
            "{ name: &quot;John&quot;, age: 31 }"
        ],
        "correct": 2,
        "explanation": "Функции <b>changeAge</b> и <b>changeAgeAndName</b> имеют параметры по умолчанию, а именно: вновь созданный объект <b>{ ...person }</b>. Этот объект имеет копии всех ключей/значений объекта <b>person</b>. Сначала мы вызываем <b>changeAge()</b> и передаем ей объект <b>person</b> в качестве аргумента. Эта функция увеличивает значение свойства <b>age</b> на <b>1</b>. <b>person</b> теперь равняется <b>{ name: &#39;John&#39;, age: 30 }</b>. Затем мы вызываем <b>changeAgeAndName()</b> без аргументов. Поэтому значение аргумента <b>x</b> равняется новому объекту <b>{ ...person }</b>. Поскольку это новый объект, он не влияет на свойства исходного объекта <b>person</b>. Таким образом, <b>person</b> по-прежнему равняется <b>{ name: &#39;John&#39;, age: 30 }</b>."
    },
    {
        "id": 99,
        "question": "function sumValues(x, y, z) {\r\n  return x + y + z // 6\r\n}",
        "options": [
            "sumValues([...1, 2, 3])",
            "sumValues([...[1, 2, 3]])",
            "sumValues(...[1, 2, 3])",
            "sumValues([1, 2, 3])"
        ],
        "correct": 2,
        "explanation": "С помощью spread-оператора (<b>...</b>) мы разбиваем итерируемые сущности на отдельные элементы. Функция <b>sumValues</b> принимает три аргумента: <b>x, y и z</b>. Для того, чтобы эта функция вернула <b>6</b>, ей в качестве аргумента необходимо передать <b>...[1, 2, 3]</b>."
    },
    {
        "id": 100,
        "question": "let num = 1\r\nconst list = [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;]\r\n\r\nconsole.log(list[(num += 1)])",
        "options": [
            "b",
            "c",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "С помощью оператора <b>+=</b> мы увеличиваем значение переменной <b>num</b> на <b>1</b>. Начальным значением <b>num</b> является <b>1</b>, выражение <b>1 + 1</b> оценивается как <b>2</b>. Элементом массива со вторым индексом является <b>c</b>, что и выводится в консоль."
    },
    {
        "id": 101,
        "question": "const person = {\r\n  firstName: &#39;John&#39;,\r\n  lastName: &#39;Smith&#39;,\r\n  pet: {\r\n    name: &#39;Rex&#39;,\r\n  },\r\n  getFullName() {\r\n    return `${this.firstName} ${this.lastName}`\r\n  }\r\n}]\r\nconst member = {}\r\n\r\nconsole.log(person.pet?.name)\r\nconsole.log(person.pet?.family?.name)\r\nconsole.log(person.getFullName?.())\r\nconsole.log(member.getLastName?.())",
        "options": [
            "undefined undefined undefined undefined",
            "Rex undefined John Smith undefined",
            "Rex null John Smith null",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "Благодаря оператору опциональной последовательности (<b>?.</b>) нам больше не нужно предварительно определять наличие глубоко вложенных свойств. Если мы попытаемся получить доступ к свойству значения <b>undefined</b> или <b>null</b>, выражение вернет <b>undefined</b>. <b>person.pet?.name</b>: объект <b>person</b> имеет свойство <b>pet</b>, <b>pet</b> имеет свойство <b>name</b> - возвращается <b>Rex</b>. <b>person.pet?.family?.name</b>: объект <b>person</b> имеет свойство <b>pet</b>, <b>pet</b> не имеет свойства <b>family</b> - возвращается <b>undefined</b>. <b>person.getFullName?.()</b>: объект <b>person</b> имеет метод <b>getFullName</b> - возвращается <b>John Smith</b>. <b>member.getLastName?.()</b>: объект <b>member</b> не имеет метода <b>getLastName</b>, возвращается <b>undefined</b>."
    },
    {
        "id": 102,
        "question": "const groceries = [&#39;банан&#39;, &#39;яблоко&#39;, &#39;апельсин&#39;]\r\n\r\nif (groceries.indexOf(&#39;банан&#39;)) {\r\n  console.log(&#39;Нам нужно купить бананы!&#39;)\r\n} else {\r\n  console.log(&#39;Нам не нужно покупать бананы!&#39;)\r\n}",
        "options": [
            "Нам нужно купить бананы!",
            "Нам не нужно покупать бананы!",
            "undefined",
            "1"
        ],
        "correct": 1,
        "explanation": "Условие <b>groceries.indexOf(&#39;banana&#39;)</b> возвращает значение <b>0</b>, которое является ложным. Поскольку условие не удовлетворяется, выполняется код в блоке <b>else</b>, в консоль выводится <b>Нам не нужно покупать бананы!</b>"
    },
    {
        "id": 103,
        "question": "const config = {\r\n  languages: [],\r\n  set language(lang) {\r\n    return this.languages.push(lang)\r\n  }\r\n}\r\n\r\nconsole.log(config.language)",
        "options": [
            "function language(lang) { this.languages.push(lang }",
            "0",
            "[]",
            "undefined"
        ],
        "correct": 3,
        "explanation": "Метод <b>language</b> - это сеттер. Сеттеры не имеют собственных значений, их задача - модифицировать свойства объекта. Поэтому вызов сеттера возвращает <b>undefined</b>."
    },
    {
        "id": 104,
        "question": "const name = &#39;John Smith&#39;\r\n\r\nconsole.log(!typeof name === &#39;object&#39;)\r\nconsole.log(!typeof name === &#39;string&#39;)",
        "options": [
            "false true",
            "true false",
            "false false",
            "true true"
        ],
        "correct": 2,
        "explanation": "Выражение <b>typeof name</b> возвращает <b>string</b>. <b>string</b> - это истинное значение, поэтому выражение <b>!typeof name</b> возвращает <b>false</b>. <b>false === &#39;object&#39;</b> и <b>false === &#39;string&#39;</b> возвращают <b>false</b> (если мы хотим сравнить типы значений вместо <b>!typeof</b> следует использовать <b>!==</b>)."
    },
    {
        "id": 105,
        "question": "const add = x =&gt; y =&gt; z =&gt; {\r\n  console.log(x, y, z)\r\n  return x + y + z\r\n}\r\n\r\nadd(4)(5)(6)",
        "options": [
            "4 5 6",
            "6 5 4",
            "4 function function",
            "undefined undefined 6"
        ],
        "correct": 0,
        "explanation": "Функция <b>add</b> возвращает стрелочную функцию, которая возвращает стрелочную функцию, которая возвращает стрелочную функцию (вы еще здесь?). Это называется каррированием (currying). Первая функция принимает аргумент <b>x</b> со значением <b>4</b>. Мы вызываем вторую функцию с аргументом <b>y</b>, имеющим значение <b>5</b>. Затем мы вызываем третью функцию с аргументом <b>z</b> со значением <b>6</b>. Когда мы пытаемся получить доступ к значениям <b>x</b> и <b>y</b>, движок <b>JavaScript</b> поднимается по цепочке областей видимости в поисках соответствующих значений. Возвращается <b>4 5 6</b>."
    },
    {
        "id": 106,
        "question": "async function* range(start, end) {\r\n  for (let i = start; i &lt;= end; i++) {\r\n    yield Promise.resolve(i)\r\n  }\r\n}\r\n\r\n;(async () =&gt; {\r\n  const gen = range(1, 3)\r\n  for await (const item of gen) {\r\n    console.log(item)\r\n  }\r\n})()",
        "options": [
            "`Promise {1} Promise {2} Promise {3}`",
            "`Promise {&lt;pending&gt;} Promise {&lt;pending&gt;} Promise {&lt;pending&gt;}`",
            "1 2 3",
            "undefined undefined undefined"
        ],
        "correct": 2,
        "explanation": "Функция-генератор <b>range</b> возвращает асинхронный объект с промисами для каждого переданного значения: <b>Promise{1}, Promise{2}, Promise{3}</b>. Мы присваиваем переменной <b>gen</b> этот объект и перебираем его элементы с помощью цикла <b>for-await-of</b>. Мы устанавливаем значение переменной <b>item</b> равным значению промиса. Поскольку мы ожидаем значения <b>item</b>, т.е. разрешения промиса, то получаем <b>1 2 3</b>."
    },
    {
        "id": 107,
        "question": "const myFunc = ({ x, y, z }) =&gt; {\r\n  console.log(x, y, z)\r\n}\r\n\r\nmyFunc(1, 2, 3)",
        "options": [
            "1 2 3",
            "{ 1: 1 } { 2: 2 } { 3: 3 }",
            "{ 1: undefined } undefined undefined",
            "undefined undefined undefined"
        ],
        "correct": 3,
        "explanation": "Функция <b>myFunc</b> в качестве аргумента ожидает получить объект со свойствами <b>x, y и z</b>. Поскольку мы передаем ей <b>1, 2, 3</b>, а не <b>{ x: 1, y: 2, z: 3 }</b>, то возвращается значение <b>x, y и z</b> по умолчанию, т.е. <b>undefined</b>."
    },
    {
        "id": 108,
        "question": "const spookyItems = [&#39;👻&#39;, &#39;🎃&#39;, &#39;👿&#39;]\r\n({ item: spookyItems[3] } = { item: &#39;💀&#39; })\r\n\r\nconsole.log(spookyItems)",
        "options": [
            "[&quot;👻&quot;, &quot;🎃&quot;, &quot;👿&quot;]",
            "[&quot;👻&quot;, &quot;🎃&quot;, &quot;👿&quot;, &quot;💀&quot;]",
            "[&quot;👻&quot;, &quot;🎃&quot;, &quot;👿&quot;, { item: &quot;💀&quot; }]",
            "[&quot;👻&quot;, &quot;🎃&quot;, &quot;👿&quot;, &quot;[object Object]&quot;]"
        ],
        "correct": 1,
        "explanation": "Деструктурируя объекты, мы распаковываем значения правого объекта и присваиваем их одноименному свойству левого объекта. В данном случае мы присваиваем значение <b>💀</b> <b>spookyItems[3]</b>. Это означает, что мы модифицируем массив <b>spookyItems</b>, добавляя в него <b>💀</b>. Поэтому получаем <b>[&quot;👻&quot;, &quot;🎃&quot;, &quot;👿&quot;, &quot;💀&quot;]</b>."
    },
    {
        "id": 109,
        "question": "const name = &#39;John Smith&#39;\r\nconst age = 30\r\n\r\nconsole.log(Number.isNaN(name))\r\nconsole.log(Number.isNaN(age))\r\n\r\nconsole.log(isNaN(name))\r\nconsole.log(isNaN(age))",
        "options": [
            "true false true false",
            "true false false false",
            "false false true false",
            "false true false true"
        ],
        "correct": 2,
        "explanation": "С помощью <b>Number.isNaN()</b> мы проверяем, является ли переданное значение числом и равняется ли оно <b>NaN</b>. <b>name</b> не является числом, поэтому <b>Number.isNaN(name)</b> возвращает <b>false</b>. <b>age</b> является числом, но не равняется <b>NaN</b>, поэтому <b>Number.isNaN(age)</b> также возвращает <b>false</b>. С помощью метода <b>isNaN</b> мы проверяем, что переданное значение не является числом. <b>name</b> не является числом, поэтому <b>isNaN(name)</b> возвращает <b>true</b>. <b>age</b> является числом, поэтому <b>isNaN(age)</b> возвращает <b>false</b>."
    },
    {
        "id": 110,
        "question": "const randomValue = 30\r\n\r\nfunction getInfo() {\r\n  console.log(typeof randomValue)\r\n  const randomValue = &#39;John Smith&#39;\r\n}\r\n\r\ngetInfo()",
        "options": [
            "number",
            "string",
            "undefined",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Переменные, объявленные с помощью ключевых слов <b>const</b> и <b>let</b> недоступны до инициализации (присваивания им значения; это называется &quot;временной мертвой зоной&quot;). В <b>getInfo()</b> областью видимости переменной <b>randomValue</b> является функция. Когда мы пытаемся вывести значение <b>randomValue</b> в консоль, выбрасывается исключение <b>ReferenceError</b>. Движок <b>JavaScript</b> не поднимается по цепочке областей видимости, поскольку мы объявили переменную <b>randomValue</b> в функции <b>getInfo</b>. Если бы мы этого не сделали, в консоль бы вывелся тип внешней (глобальной) переменной <b>randomValue</b>, т.е. <b>number</b>."
    },
    {
        "id": 111,
        "question": "const myPromise = Promise.resolve(&#39;Woah some cool data&#39;)\r\n\r\n;(async () =&gt; {\r\n  try {\r\n    console.log(await myPromise)\r\n  } catch {\r\n    throw new Error(`Oops didn&#39;t work`)\r\n  } finally {\r\n    console.log(&#39;Oh finally&#39;)\r\n  }\r\n})()",
        "options": [
            "Woah some cool data",
            "Oh finally",
            "Woah some cool data и Oh finally",
            "Oops didn&#39;t work и Oh finally"
        ],
        "correct": 2,
        "explanation": "В блоке <b>try</b> мы выводим в консоль ожидаемое (разрешенное) значение переменной <b>myPromise</b> - <b>Woah some cool data</b>. Поскольку в блоке <b>try</b> не возникло ошибки, код в блоке <b>catch</b> не выполняется. Код в блоке <b>finally</b> выполняется всегда, поэтому в консоль выводится <b>Oh finally</b>."
    },
    {
        "id": 112,
        "question": "const emojis = [&#39;💫&#39;, [&#39;✨&#39;, &#39;✨&#39;, [&#39;🍕&#39;, &#39;🍕&#39;]]]\r\n\r\nconsole.log(emojis.flat(1))",
        "options": [
            "[&#39;💫&#39;, [&#39;✨&#39;, &#39;✨&#39;, [&#39;🍕&#39;, &#39;🍕&#39;]]]",
            "[&#39;💫&#39;, &#39;✨&#39;, &#39;✨&#39;, [&#39;🍕&#39;, &#39;🍕&#39;]]",
            "[&#39;💫&#39;, [&#39;✨&#39;, &#39;✨&#39;, &#39;🍕&#39;, &#39;🍕&#39;]]",
            "[&#39;💫&#39;, &#39;✨&#39;, &#39;✨&#39;, &#39;🍕&#39;, &#39;🍕&#39;]"
        ],
        "correct": 1,
        "explanation": "С помощью метода <b>flat</b> мы создаем новый &quot;плоский&quot; массив. Глубина этого массива зависит от передаваемого значения. В данном случае мы передаем значение <b>1</b> (чего мы могли бы не делать, поскольку оно является значением по умолчанию), значит, будут объединены только массивы первого уровня вложенности, т.е. <b>[&#39;💫&#39;]</b> и <b>[&#39;✨&#39;, &#39;✨&#39;, [&#39;🍕&#39;, &#39;🍕&#39;]]</b>. Результатом объединения этих массивов является <b>[&#39;💫&#39;, &#39;✨&#39;, &#39;✨&#39;, [&#39;🍕&#39;, &#39;🍕&#39;]]</b>."
    },
    {
        "id": 113,
        "question": "class Counter {\r\n  constructor() {\r\n    this.count = 0\r\n  }\r\n\r\n  increment() {\r\n    this.count++\r\n  }\r\n}\r\n\r\nconst counterOne = new Counter()\r\ncounterOne.increment()\r\ncounterOne.increment()\r\n\r\nconst counterTwo = counterOne\r\ncounterTwo.increment()\r\n\r\nconsole.log(counterOne.count)",
        "options": [
            "0",
            "1",
            "2",
            "3"
        ],
        "correct": 3,
        "explanation": "Переменная <b>counterOne</b> является экземпляром класса <b>Counter</b>. Класс <b>Counter</b> содержит свойство <b>count</b> в конструкторе и метод <b>increment</b>, увеличивающий значение данного свойства на <b>1</b>. Сначала мы дважды вызываем <b>increment()</b>. Значением <b>counterOne.count</b> становится равным <b>2</b>. Затем мы создаем новую переменную <b>counterTwo</b> и присваиваем ей значение переменной <b>counterOne</b>. Поскольку объекты взаимодействуют между собой через ссылки, мы просто создали новую ссылку на то же самое место в памяти, на которое указывает <b>counterOne</b>. Поскольку обе переменные ссылаются на одну и ту же область памяти, любые изменения объекта, на который ссылается <b>counterTwo</b> также влияют на <b>counterOne</b>. Таким образом, значением <b>counterTwo</b> является <b>2</b>. Мы вызываем <b>counterTwo.increment()</b>, который увеличивает значение свойства <b>count</b> до <b>3</b>. Наконец, мы выводим в консоль <b>counterOne.count</b> и получаем <b>3</b>."
    },
    {
        "id": 114,
        "question": "const myPromise = Promise.resolve(\r\n    Promise.resolve(&#39;Promise!&#39;)\r\n  )\r\n\r\nfunction funcOne() {\r\n  myPromise.then(res =&gt; res).then(res =&gt; console.log(res))\r\n  setTimeout(() =&gt; console.log(&#39;Timeout!&#39;, 0))\r\n  console.log(&#39;Last line!&#39;)\r\n}\r\n\r\nasync function funcTwo() {\r\n  const res = await myPromise\r\n  console.log(await res)\r\n  setTimeout(() =&gt; console.log(&#39;Timeout!&#39;, 0))\r\n  console.log(&#39;Last line!&#39;)\r\n}\r\n\r\nfuncOne()\r\nfuncTwo()",
        "options": [
            "Promise! Last line! Promise! Last line! Last line! Promise!",
            "Last line! Timeout! Promise! Last line! Timeout! Promise!",
            "Promise! Last line! Last line! Promise! Timeout! Timeout!",
            "Last line! Promise! Promise! Last line! Timeout! Timeout!"
        ],
        "correct": 3,
        "explanation": "Сначала мы вызываем функцию <b>funcOne</b>. На первой строке этой функции мы вызываем промис <b>myPromise</b>, который является асинхронной операцией. Пока движок <b>JavaScript</b> занят разрешением промиса, выполнение <b>myFunc()</b> продолжается. На следующей строке у нас имеется асинхронная функция <b>setTimeout</b>, которая отправляется в <b>WebAPI</b>. Промис и <b>setTimeout()</b> являются асинхронными, поэтому движок продолжает выполнять код функции, не ожидая разрешения промиса и обработки <b>setTimeout()</b>. Сказанное означает, что сначала в консоль выводится <b>Last line!</b>, поскольку <b>console.log()</b> - синхронная операция. Это последняя строка кода в <b>myFunc()</b>, промис разрешается и в консоль выводится <b>Promise!</b>.\r\nВ момент вызова функции <b>funcTwo</b> стек вызовов (call stack) не является пустым, поэтому колбек <b>setTimeout()</b> не может туда попасть. В <b>funcTwo()</b> мы сначала ожидаем разрешение промиса <b>myPromise</b>. С помощью ключевого слова <b>await</b> мы приостанавливаем выполнение функции до разрешения (выполнения или отклонения) промиса. Затем мы выводим в консоль ожидаемое значение переменной <b>res</b> (поскольку промис возвращает промис). В консоль выводится <b>Promise!</b>. На следующей строке у нас снова встречается асинхронная функция <b>setTimeout</b>, которая отправляется в <b>WebAPI</b>. Мы достигаем последней строки кода в <b>funcTwo()</b>, в консоль выводится <b>Last line!</b>.\r\nПосле того, как <b>funcTwo()</b> удаляется из стека вызовов, стек оказывается пустым. Ожидающие этого в очереди задач колбеки (<b>console.log(&quot;Timeout!&quot;)</b> из <b>funcOne()</b> и <b>console.log(&quot;Timeout!&quot;)</b> из <b>funcTwo()</b>) помещаются туда одна за другой. Первый колбек выводит в консоль <b>Timeout!</b> и удаляется из стека, затем то же самое происходит со вторым колбеком. Таким образом, мы получаем <b>Last line! Promise! Promise! Last line! Timeout! Timeout!</b>."
    },
    {
        "id": 115,
        "question": "// sum.js\r\nexport default function sum(x) {\r\n  return x + x\r\n}\r\n\r\n// index.js\r\nimport * as sum from &#39;./sum&#39;\r\n/* вызов функции &quot;sum&quot; */",
        "options": [
            "sum()",
            "sum.sum()",
            "sum.default()",
            "символ * может использоваться только при именованном экспорте"
        ],
        "correct": 2,
        "explanation": "С помощью символа <b>*</b> мы импортируем все экспортируемые из файла сущности, как дефолтные, так и именованные. Если у нас есть такие файлы:\r\n\r\n// info.js\r\nexport const name = &#39;John&#39;\r\nexport const age = 30\r\nexport default &#39;I love JavaScript!&#39;\r\n\r\n// index.js\r\nimport * as info from &#39;./info&#39;\r\nconsole.log(info)\r\n\r\nВ консоль будет выведено:\r\n\r\n{ default: &quot;I love JavaScript!&quot;, name: &quot;John&quot;, age: 30 }\r\n\r\nВ данном случае импортированное значение функции <b>sum</b> выглядит примерно так:\r\n\r\n{ default: function sum(x) { return x + x } }\r\n\r\nМы можем вызвать эту функцию посредством <b>sum.default()</b>."
    },
    {
        "id": 116,
        "question": "const handler = {\r\n  set: () =&gt; console.log(&#39;Added a new property!&#39;),\r\n  get: () =&gt; console.log(&#39;Accessed a property!&#39;),\r\n}\r\n\r\nconst person = new Proxy({}, handler)\r\n\r\nperson.name = &#39;John&#39;\r\nperson.name",
        "options": [
            "Added a new property!",
            "Accessed a property!",
            "Added a new property! Accessed a property!",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "С помощью прокси (Proxy) мы можем добавить объекту, передаваемому в качестве второго аргумента, определенное поведение. В данном случае мы передаем объект <b>handler</b>, который имеет два свойства: <b>set</b> и <b>get</b>. <b>set</b> вызывается при установке значений, а <b>get</b> - при их получении. Первый аргумент прокси - пустой объект (<b>{}</b>), который является значением переменной <b>person</b>. Поведение этого объекта определено в объекте <b>handler</b>. При добавлении свойства объекту <b>person</b> вызывается метод <b>set</b>. При получении доступа к свойству <b>person</b> вызывается <b>get()</b>. Сначала мы добавляем прокси новое свойство <b>name</b>. Вызывается метод <b>set</b> и в консоль выводится <b>Added a new property!</b>. Затем мы получаем значение свойства <b>name</b>. Вызывается <b>get()</b> и в консоль выводится <b>Accessed a property!</b>."
    },
    {
        "id": 117,
        "question": "const person = {\r\n  name: &#39;John Smith&#39;,\r\n  address: {\r\n    street: &#39;100 Some Street&#39;,\r\n  }\r\n}\r\n\r\nObject.freeze(person)\r\nperson.address.street = &quot;101 Main Street&quot;\r\nconsole.log(person.address.street)",
        "options": [
            "false",
            "100 Some Street",
            "101 Main Street",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "<b>Object.freeze()</b> &quot;замораживает&quot; объект. В такой объект нельзя добавлять новые свойства, а существующие свойства не могут изменяться или удаляться. Тем не менее, объект замораживается поверхностно. Это означает, что свойства первого уровня вложенности иммутабельны (неизменяемы/неизменны). Однако в случае, когда таким свойством является объект (<b>address</b>), его свойства можно изменять."
    },
    {
        "id": 118,
        "question": "const add = x =&gt; x + x\r\n\r\nfunction myFunc(num = 2, value = add(num)) {\r\n  console.log(num, value)\r\n}\r\n\r\nmyFunc()\r\nmyFunc(3)",
        "options": [
            "2 4 и 3 6",
            "2 NaN и 3 NaN",
            "2 undefined и 3 6",
            "2 4 и 3 undefined"
        ],
        "correct": 0,
        "explanation": "Сначала мы вызываем функцию <b>myFunc</b> без аргументов. Поэтому аргументам присваиваются значения по умолчанию: <b>num</b> - <b>2</b>, а <b>value</b> - значение, возвращаемое функцией <b>add</b>. Мы передаем <b>add()</b> значение <b>num</b> в качестве аргумента, которое равняется <b>2</b>. <b>add()</b> возвращает <b>4</b>, что является значением <b>value</b>. Затем мы вызываем <b>myFunc()</b> с аргументом <b>3</b>, которое присваивается <b>num</b>. Поскольку мы не присваиваем значения <b>value</b>, его значением вновь становится значение, возвращаемое <b>add()</b>. Мы передаем <b>add()</b> значение <b>3</b>, она возвращает <b>6</b>, что становится значением <b>value</b>."
    },
    {
        "id": 119,
        "question": "class Counter {\r\n  #number = 10\r\n\r\n  increment() {\r\n    this.#number++\r\n  }\r\n\r\n  getNum() {\r\n    return this.#number\r\n  }\r\n}\r\n\r\nconst counter = new Counter()\r\ncounter.increment()\r\n\r\nconsole.log(counter.#number)",
        "options": [
            "10",
            "11",
            "undefined",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "В <b>ECMAScript 2020</b> мы можем добавлять классам приватные (частные/закрытые) переменные с помощью символа <b>#</b>. Мы не можем получить доступ к таким переменным за пределами класса. Поэтому, когда мы пытается вывести в консоль значение <b>counter.#number</b>, выбрасывается исключение <b>SyntaxError</b>."
    },
    {
        "id": 120,
        "question": "const teams = [\r\n  { name: &#39;Team 1&#39;, members: [&#39;John&#39;, &#39;Jane&#39;] },\r\n  { name: &#39;Team 2&#39;, members: [&#39;Alice&#39;, &#39;Bob&#39;] },\r\n]\r\n\r\nfunction* getMembers(members) {\r\n  for (let i = 0; i &lt; members.length; i++) {\r\n    yield members[i]\r\n  }\r\n}\r\n\r\nfunction* getTeams(teams) {\r\n  for (let i = 0; i &lt; teams.length; i++) {\r\n    /* ? */\r\n  }\r\n}\r\n\r\nconst obj = getTeams(teams)\r\nobj.next() // { value: &quot;John&quot;, done: false }\r\nobj.next() // { value: &quot;Jane&quot;, done: false }",
        "options": [
            "yield getMembers(teams[i].members)",
            "yield* getMembers(teams[i].members)",
            "return getMembers(teams[i].members)",
            "return yield getMembers(teams[i].members)"
        ],
        "correct": 1,
        "explanation": "Для того, чтобы перебрать <b>members</b> в каждом элементе массива <b>items</b>, нам необходимо передать <b>teams[i].members</b> в функцию-генератор <b>getMembers</b>. Генератор возвращает объект. Для того, чтобы перебрать элементы этого объекта следует использовать <b>yield*</b>. Если мы не укажем <b>yield</b>, <b>return yield</b> или <b>return</b>, внутренняя функция-генератор не будет возвращена при первом вызове метода <b>next</b>."
    },
    {
        "id": 121,
        "question": "const person = {\r\n  name: &#39;John Smith&#39;,\r\n  hobbies: [&#39;coding&#39;],\r\n}\r\n\r\nfunction addHobby(hobby, hobbies = person.hobbies) {\r\n  hobbies.push(hobby)\r\n  return hobbies\r\n}\r\n\r\naddHobby(&#39;running&#39;, [])\r\naddHobby(&#39;dancing&#39;)\r\naddHobby(&#39;baking&#39;, person.hobbies)\r\n\r\nconsole.log(person.hobbies)",
        "options": [
            "[&quot;coding&quot;]",
            "[&quot;coding&quot;, &quot;dancing&quot;]",
            "[&quot;coding&quot;, &quot;dancing&quot;, &quot;baking&quot;]",
            "[&quot;coding&quot;, &quot;running&quot;, &quot;dancing&quot;, &quot;baking&quot;]"
        ],
        "correct": 2,
        "explanation": "Функция <b>addHobby</b> принимает два аргумента: <b>hobby</b> и <b>hobbies</b> с дефолтным значением, равным свойству <b>hobbies</b> объекта <b>person</b>. Сначала мы вызываем <b>addHobby()</b> и передаем ей <b>running</b> в качестве значения для <b>hobby</b> и пустой массив в качестве значения для <b>hobbies</b>. Поскольку мы передали пустой массив в качестве значения для <b>hobbies</b>, в него добавляется <b>running</b>. Затем мы вызываем <b>addHobby()</b> и передаем ей <b>dancing</b> в качестве значения для <b>hobby</b>. При этом, мы не передаем значения для <b>hobbies</b>, поэтому он получает значение по умолчанию, т.е. значение свойства <b>hobbies</b> объекта <b>person</b>. В этот массив добавляется <b>dancing</b>. Наконец, мы вызываем <b>addHobby()</b> и передаем ей <b>baking</b> в качестве значения для <b>hobby</b> и массив <b>person.hobbies</b> в качестве значения для <b>hobbies</b>. Мы добавляем <b>baking</b> в массив <b>person.hobbies</b>. После добавления <b>dancing</b> и <b>baking</b> значением <b>person.hoobies</b> является <b>[&quot;coding&quot;, &quot;dancing&quot;, &quot;baking&quot;]</b>."
    },
    {
        "id": 122,
        "question": "class Bird {\r\n  constructor() {\r\n    console.log(&quot;I&#39;m a bird. 🐤&quot;)\r\n  }\r\n}\r\n\r\nclass Flamingo extends Bird {\r\n  constructor() {\r\n    console.log(&quot;I&#39;m pink. 🌸&quot;)\r\n    super()\r\n  }\r\n}\r\n\r\nconst pet = new Flamingo()",
        "options": [
            "I&#39;m pink. 🌸",
            "I&#39;m pink. 🌸 и I&#39;m a bird. 🐤",
            "I&#39;m a bird. 🐤 и I&#39;m pink. 🌸",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Мы создаем переменную <b>pet</b>, которая является экземпляром класса <b>Flamingo</b>. При создании экземпляра вызывается <b>constructor()</b>. В консоль выводится <b>I&#39;m pink. 🌸</b>, после чего вызывается <b>super()</b>. <b>super()</b> вызывает конструктор родительского класса. В консоль выводится <b>I&#39;m a bird. 🐤</b>."
    },
    {
        "id": 123,
        "question": "const person = {\r\n  name: &quot;John Smith&quot;,\r\n  age: 30\r\n}\r\n\r\n[...person] // [&quot;John Smith&quot;, 30]",
        "options": [
            "объекты являются итерируемыми по умолчанию",
            "`*[Symbol.iterator]() { for (let x in this) yield* this[x] }`",
            "`*[Symbol.iterator]() { yield* Object.values(this) }`",
            "`*[Symbol.iterator]() { for (let x in this) yield this }`"
        ],
        "correct": 2,
        "explanation": "Объекты не являются итерируемыми (перебираемыми) по умолчанию. В итерируемых сущностях имеется протокол итератора. Мы можем реализовать такой протокол вручную, добавив в объект символ итератора (<b>[Symbol.iterator]</b>), который будет возвращать объект-генератор. Мы, например, можем преобразовать исходный объект в функцию-генератор с помощью <b>[Symbol.iterator]() {}</b>. Эта функция-генератор будет перебирать значения объекта <b>person</b>. Если мы хотим вернуть массив <b>[&#39;John Smith&#39;, 30]</b>, то объект должен выглядеть так: <b>yield* Object.values(this)</b>."
    },
    {
        "id": 124,
        "question": "let count = 0\r\nconst nums = [0, 1, 2, 3]\r\n\r\nnums.forEach(num =&gt; {\r\n  if (num) count += 1\r\n})\r\n\r\nconsole.log(count)",
        "options": [
            "1",
            "2",
            "3",
            "4"
        ],
        "correct": 2,
        "explanation": "Условие в цикле <b>forEach</b> проверяет, является ли значение переменной <b>num</b> истинным. Поскольку первым значением <b>num</b> является <b>0</b> (ложное значение), код в блоке <b>if</b> не выполняется. Остальные значения <b>num</b> (<b>1, 2, 3</b>) являются истинными, поэтому значение <b>count</b> увеличивается на <b>1</b> три раза. В результате значением <b>count</b> становится <b>3</b>."
    },
    {
        "id": 125,
        "question": "function getFruit(fruits) {\r\n  console.log(fruits?.[1]?.[1])\r\n}\r\n\r\ngetFruit([[&#39;🍊&#39;, &#39;🍌&#39;], [&#39;🍍&#39;]])\r\ngetFruit()\r\ngetFruit([[&#39;🍍&#39;], [&#39;🍊&#39;, &#39;🍌&#39;]])",
        "options": [
            "null undefined 🍌",
            "[] null 🍌",
            "[] [] 🍌",
            "undefined undefined 🍌"
        ],
        "correct": 3,
        "explanation": "Оператор <b>?.</b> (опциональная последовательность) позволяет нам безопасно получать доступ к глубоко вложенным и потенциально несуществующим свойствам объектов. Мы пытаемся вывести в консоль элемент с индексом <b>1</b> подмассива с индексом <b>1</b> массива <b>fruits</b>. Если подмассива с индексом <b>1</b> в массиве <b>fruits</b> не существует, возвращается <b>undefined</b>. Если подмассив с индексом <b>1</b> в массиве <b>fruits</b> существует, но не имеет элемента с индексом <b>1</b>, также возвращается <b>undefined</b>. Сначала мы пытаемся вывести в консоль второй элемент подмассива <b>[&#39;🍍&#39;]</b> массива <b>[[&#39;🍊&#39;, &#39;🍌&#39;], [&#39;🍍&#39;]]]</b>. Этот подмассив состоит из одного элемента, т.е. элемента с индексом <b>1</b> в данном массиве не существует, поэтому возвращается <b>undefined</b>. Затем мы вызываем функцию <b>getFruits</b> без аргументов, поэтому массив <b>fruits</b> имеет значение <b>undefined</b>. Наконец, мы пытаемся вывести в консоль второй элемент подмассива <b>[&#39;🍊&#39;, &#39;🍌&#39;]</b> массива <b>[&#39;🍍&#39;], [&#39;🍊&#39;, &#39;🍌&#39;]</b>. Элементом с индексом <b>1</b> этого подмассива является <b>🍌</b>, что и выводится в консоль."
    },
    {
        "id": 126,
        "question": "class Calc {\r\n  constructor() {\r\n    this.count = 0\r\n  }\r\n\r\n  increase() {\r\n    this.count++\r\n  }\r\n}\r\n\r\nconst calc = new Calc()\r\nnew Calc().increase()\r\n\r\nconsole.log(calc.count)",
        "options": [
            "0",
            "1",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "Мы присваиваем переменной <b>calc</b> значение нового экземпляра класса <b>Calc</b>. Затем мы инициализируем новый экземпляр класса <b>Calc</b> и вызываем его метод <b>increase</b>. Поскольку свойство <b>count</b> находится в конструкторе класса <b>Calc</b>, данное свойство не является общим для экземпляров класса <b>Calc</b>. Это означает, что свойство <b>count</b> не обновляется для <b>calc</b>, оно по-прежнему равняется <b>0</b>."
    },
    {
        "id": 127,
        "question": "const user = {\r\n  email: &quot;e@mail.com&quot;,\r\n  password: &quot;12345&quot;\r\n}\r\n\r\nconst updateUser = ({ email, password }) =&gt; {\r\n  if (email) {\r\n    Object.assign(user, { email })\r\n  }\r\n\r\n  if (password) {\r\n    user.password = password\r\n  }\r\n\r\n  return user\r\n}\r\n\r\nconst updatedUser = updateUser({ email: &quot;new@email.com&quot; })\r\n\r\nconsole.log(updatedUser === user)",
        "options": [
            "false",
            "true",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Функция <b>updateUser</b> обновляет свойства <b>email</b> и <b>password</b> объекта <b>user</b>, если их значения переданы в качестве аргументов, после чего функция возвращает объект <b>user</b>. Значением, которое вернула <b>updateUser()</b>, является объект <b>user</b>. Таким образом, переменная <b>updatedUser</b> ссылается на то же место в памяти, что и сам <b>user</b>. Поэтому выражение <b>updatedUser === user</b> возвращает <b>true</b>."
    },
    {
        "id": 128,
        "question": "const fruits = [&#39;🍌&#39;, &#39;🍊&#39;, &#39;🍎&#39;]\r\n\r\nfruits.slice(0, 1)\r\nfruits.splice(0, 1)\r\nfruits.unshift(&#39;🍇&#39;)\r\n\r\nconsole.log(fruits)",
        "options": [
            "[&#39;🍌&#39;, &#39;🍊&#39;, &#39;🍎&#39;]",
            "[&#39;🍊&#39;, &#39;🍎&#39;]",
            "[&#39;🍇&#39;, &#39;🍊&#39;, &#39;🍎&#39;]",
            "[&#39;🍇&#39;, &#39;🍌&#39;, &#39;🍊&#39;, &#39;🍎&#39;]"
        ],
        "correct": 2,
        "explanation": "Сначала мы вызываем метод <b>slice</b> для массива <b>fruits</b>. Данный метод не модифицирует исходный массив и возвращает извлеченное значение: <b>🍌</b>. Затем мы вызываем метод <b>splice</b>. Данный метод модифицирует исходный массив, <b>fruits</b> теперь выглядит так: <b>[&#39;🍊&#39;, &#39;🍎&#39;]</b>. Наконец, мы вызываем метод <b>unshift</b>, который также модифицирует исходный массив, добавляя к нему <b>🍇</b> в качестве первого элемента. Массив <b>fruits</b> теперь выглядит так: <b>[&#39;🍇&#39;, &#39;🍊&#39;, &#39;🍎&#39;]</b>."
    },
    {
        "id": 129,
        "question": "const animals = {}\r\nlet dog = { emoji: &#39;🐶&#39; }\r\nlet cat = { emoji: &#39;🐈&#39; }\r\n\r\nanimals[dog] = { ...dog, name: &quot;Rex&quot; }\r\nanimals[cat] = { ...cat, name: &quot;Niko&quot; }\r\n\r\nconsole.log(animals[dog])",
        "options": [
            "{ emoji: &quot;🐶&quot;, name: &quot;Rex&quot; }",
            "{ emoji: &quot;🐈&quot;, name: &quot;Niko&quot; }",
            "undefined",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "Ключи объекта конвертируются (преобразуются) в строки. Поскольку значением переменной <b>dog</b> является объект, <b>animals[dog]</b> означает, что мы создаем новое свойство с именем <b>object Object</b>, значением которого является новый объект. <b>animals[&quot;object Object&quot;]</b> равняется <b>{ emoji: &quot;🐶&quot;, name: &quot;Rex&quot;}</b>. Значением переменной <b>cat</b> также является объект. Это означает, что мы перезаписываем свойство <b>animals[&quot;object Object&quot;]</b> новым значением. Поэтому, когда мы выводим в консоль <b>animals[dog]</b>, мы на самом деле обращаемся к <b>animals[&quot;object Object&quot;]</b>, поэтому получаем <b>{ emoji: &quot;🐈&quot;, name: &quot;Niko&quot; }</b>."
    },
    {
        "id": 130,
        "question": "const user = {\r\n  email: &quot;my@email.com&quot;,\r\n  updateEmail: email =&gt; {\r\n    this.email = email\r\n  }\r\n}\r\n\r\nuser.updateEmail(&quot;new@email.com&quot;)\r\nconsole.log(user.email)",
        "options": [
            "my@email.com",
            "new@email.com",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "Функция <b>updateEmail</b> является стрелочной, поэтому она не привязана (bind) к объекту <b>user</b>. Это означает, что ключевое слово <b>this</b> не ссылается на объект <b>user</b>. В данном случае <b>this</b> указывает на глобальную область видимости (<b>window</b> в браузере, <b>global</b> в <b>Node.js</b>). Значение свойства <b>email</b> объекта <b>user</b> не обновляется. Поэтому, когда мы обращаемся к <b>user.email</b>, в консоль выводится <b>my@email.com</b>."
    },
    {
        "id": 131,
        "question": "const promise1 = Promise.resolve(&#39;First&#39;)\r\nconst promise2 = Promise.resolve(&#39;Second&#39;)\r\nconst promise3 = Promise.reject(&#39;Third&#39;)\r\nconst promise4 = Promise.resolve(&#39;Fourth&#39;)\r\n\r\nconst runPromises = async () =&gt; {\r\n  const res1 = await Promise.all([promise1, promise2])\r\n  const res2  = await Promise.all([promise3, promise4])\r\n  return [res1, res2]\r\n}\r\n\r\nrunPromises()\r\n  .then(res =&gt; console.log(res))\r\n  .catch(er =&gt; console.log(er))",
        "options": [
            "[[&#39;First&#39;, &#39;Second&#39;] и [&#39;Fourth&#39;]]",
            "[[&#39;First&#39;, &#39;Second&#39;] и [&#39;Third&#39;, &#39;Fourth&#39;]]",
            "[[&#39;First&#39;, &#39;Second&#39;]]",
            "&#39;Third&#39;"
        ],
        "correct": 3,
        "explanation": "<b>Promise.all()</b> выполняет переданные ему промисы одновременно (параллельно). Если один из промисов отклоняется, <b>Promise.all()</b> также отклоняется со значением отклоненного промиса. В данном случае <b>promise3</b> отклоняется со значением <b>Third</b>. Мы обрабатываем отклоненное значение в блоке <b>catch</b> функции <b>runPromises</b>. Поэтому в консоль выводится только <b>Third</b>."
    },
    {
        "id": 132,
        "question": "const keys = [&quot;name&quot;, &quot;age&quot;]\r\nconst values = [&quot;John&quot;, 30]\r\n\r\nconst method = /* ? */\r\n\r\nObject[method](keys.map((_, i) =&gt; {\r\n  return [keys[i], values[i]]\r\n})) // { name: &quot;John&quot;, age: 30 }",
        "options": [
            "entries",
            "values",
            "fromEntries",
            "forEach"
        ],
        "correct": 2,
        "explanation": "Метод <b>fromEntries</b> преобразует двумерный массив в объект. Первый элемент каждого подмассива становится ключом, а второй - значением. В данном случае мы перебираем элементы массива <b>keys</b>, возвращая массив, первым элементом которого является элемент массива <b>keys</b> с текущим индексом, вторым элементом - элемент массива <b>values</b> с текущим индексом. Это создает массив массивов с правильными ключами и значениями, которые преобразуются в <b>{ name: &#39;John&#39;, age: 30 }</b>."
    },
    {
        "id": 133,
        "question": "const createMember = ({ email, address = {}}) =&gt; {\r\n  const validEmail = /.+@.+..+/.test(email)\r\n  if (!validEmail) throw new Error(&quot;Valid email please&quot;)\r\n\r\n  return {\r\n    email,\r\n    address: address ? address : null\r\n  }\r\n}\r\n\r\nconst member = createMember({ email: &quot;my@email.com&quot; })\r\nconsole.log(member)",
        "options": [
            "{ email: &quot;my@email.com&quot;, address: null }",
            "{ email: &quot;my@email.com&quot; }",
            "{ email: &quot;my@email.com&quot;, address: {} }",
            "{ email: &quot;my@email.com&quot;, address: undefined }"
        ],
        "correct": 2,
        "explanation": "Значением <b>address</b> по умолчанию является пустой объект (<b>{}</b>). Когда мы присваиваем переменной <b>member</b> значение, возвращаемое функцией <b>createMember</b>, мы не передаем значение для <b>address</b>, поэтому ее значением становится <b>{}</b>. Пустой объект - это истинное значение, поэтому условие <b>address ? address : null</b> возвращает <b>address</b>. Значением <b>address</b> является <b>{}</b>."
    },
    {
        "id": 134,
        "question": "let randomValue = { name: &quot;John&quot; }\r\nrandomValue = 30\r\n\r\nif (!typeof randomValue === &quot;string&quot;) {\r\n  console.log(&quot;Это не строка!&quot;)\r\n} else {\r\n  console.log(&quot;Это строка!&quot;)\r\n}",
        "options": [
            "Это не строка!",
            "Это строка!",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Условие <b>if</b> проверяет, является ли <b>!typeof randomValue</b> строкой. Оператор <b>!</b> преобразует значение в логический тип данных и инвертирует его. Если значение истинно, возвращается <b>false</b>, если ложно - <b>true</b>. В данном случае значением <b>typeof randomValue</b> является <b>number</b>, что есть истина, поэтому возвращается <b>false</b>. Выражение <b>!typeof randomValue === &#39;string&#39;</b> возвращает <b>false</b>, поскольку на самом деле мы проверяем <b>false === &#39;string&#39;</b>. Условие возвращает <b>false</b>, поэтому выполняется код в блоке <b>else</b> и в консоль выводится <b>Это строка!</b>."
    },
    {
        "id": 135,
        "question": "var car = new Vehicle(&quot;Honda&quot;, &quot;white&quot;, &quot;2010&quot;, &quot;UK&quot;)\r\nconsole.log(car)\r\n\r\nfunction Vehicle(model, color, year, country) {\r\n  this.model = model\r\n  this.color = color\r\n  this.year = year\r\n  this.country = country\r\n}",
        "options": [
            "undefined",
            "ошибка",
            "null",
            "{ model: &quot;Honda&quot;, color: &quot;white&quot;, year: &quot;2010&quot;, country: &quot;UK&quot; }"
        ],
        "correct": 3,
        "explanation": "Объявление функции поднимается в начало области видимости подобно объявлению переменной. Это называется поднятием или подъемом (hoisting). Поэтому место объявления функции <b>Venicle</b> в данном случае значения не имеет."
    },
    {
        "id": 136,
        "question": "function foo() {\r\n  let x = y = 0\r\n  x++\r\n  y++\r\n  return x\r\n}\r\n\r\nconsole.log(foo(), typeof x, typeof y)",
        "options": [
            "1 undefined undefined",
            "ошибка",
            "1 undefined number",
            "1 number number"
        ],
        "correct": 2,
        "explanation": "Функция <b>foo</b> возвращает <b>1</b> из-за оператора <b>++</b>. Выражение <b>let x = y = 0</b> определяет локальную переменную <b>x</b>. Однако <b>y</b> определяется как глобальная переменная. Данное выражение эквивалентно следующему:\r\n\r\nlet x\r\nwindow.y = 0\r\nx = window.y\r\n\r\nПоскольку переменная <b>x</b> за пределами функции имеет значение <b>undefined</b>, т.е. не определена, ее типом также является <b>undefined</b>. Однако <b>y</b> за пределами функции доступна и имеет значение <b>0</b> с типом <b>number</b>."
    },
    {
        "id": 137,
        "question": "function main() {\r\n  console.log(&#39;A&#39;)\r\n  setTimeout(function print() {\r\n    console.log(&#39;B&#39;)\r\n  }, 0)\r\n  console.log(&#39;C&#39;)\r\n}\r\n\r\nmain()",
        "options": [
            "A B C",
            "B A C",
            "A C",
            "A C B"
        ],
        "correct": 3,
        "explanation": "Порядок выполнения функций зависит от стека вызовов (call stack). В данном случае он будет таким:\r\n1. Сначала в стек помещается функция <b>main</b>.\r\n2. Затем в стек помещается <b>console.log(&#39;A&#39;)</b>, выполняется и удаляется из стека.\r\n3. Далее <b>setTimeot()</b> отправляется в <b>WebAPI</b>, а оставшийся код продолжает выполняться.\r\n4. В стек помещается <b>console.log(&#39;C&#39;)</b>, выполняется и удаляется из стека.\r\n5. Колбек <b>setTimeout()</b> помещается в очередь задач (task queue, второе слово читается как &quot;кью&quot;).\r\n6. Функция <b>main</b> удаляется из стека.\r\n7. После того, как стек вызовов опустел, в него помещается колбек из очереди задач.\r\n8. В стек помещается <b>console.log(&#39;B&#39;)</b>, выполняется и удаляется из стека."
    },
    {
        "id": 138,
        "question": "console.log(0.1 + 0.2 === 0.3)",
        "options": [
            "false",
            "true",
            "undefined",
            "ошибка"
        ],
        "correct": 0,
        "explanation": "Здесь мы имеем дело с распространенной проблемой чисел с плавающей точкой (или запятой, или чисел двойной точности, см. <b>IEEE 754</b>). Поскольку такие числа преобразуются в двоичные данные, имеет место некоторая неточность округления. Поэтому математические операции с названными числами порой приводят к неожиданным результатам. В частности, значением выражения <b>0.1 + 0.2</b> будет <b>0.30000000000000004</b>, что чуть больше, чем <b>0.3</b>. Поэтому сравнение <b>0.1 + 0.2 === 0.3</b> возвращает <b>false</b>."
    },
    {
        "id": 139,
        "question": "var y = 1\r\nif (function f(){}) {\r\n  y += typeof f\r\n}\r\nconsole.log(y)",
        "options": [
            "1function",
            "1object",
            "ошибка",
            "1undefined"
        ],
        "correct": 3,
        "explanation": "Условие <b>if (function f(){})</b> возвращает <b>true</b> (функция - это объект). Поскольку переменная <b>f</b> нигде не определяется, она имеет значение <b>undefined</b> по умолчанию с типом <b>undefined</b>. Получаем <b>1 + undefined</b> или <b>1undefined</b> (оба операнда приводятся к строке)."
    },
    {
        "id": 140,
        "question": "function foo() {\r\nreturn\r\n  {\r\n    message: &quot;Hello World&quot;\r\n  }\r\n}\r\nconsole.log(foo())",
        "options": [
            "Hello World",
            "Object { message: &quot;Hello World&quot; }",
            "undefined",
            "ошибка"
        ],
        "correct": 2,
        "explanation": "Здесь мы имеем дело с автоматической расстановкой точек с запятой движком <b>JavaScript</b>. В данном случае точка с запятой автоматически вставляется после оператора <b>return</b>. Поэтому функция возвращает <b>undefined</b>.\r\nЕсли поставить <b>{</b> перед <b>return</b>, то функция будет работать, как ожидается:\r\n\r\nfunction foo() { return { message: &#39;Hello World&#39; } }\r\nconsole.log(foo()) // { message: &#39;Hello World&#39; }"
    },
    {
        "id": 141,
        "question": "var myChars = [&#39;a&#39;, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;]\r\ndelete myChars[0]\r\nconsole.log(myChars)\r\nconsole.log(myChars[0])\r\nconsole.log(myChars.length)",
        "options": [
            "[empty, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;] empty 3",
            "[null, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;] empty 3",
            "[empty, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;] undefined 4",
            "[null, &#39;b&#39;, &#39;c&#39;, &#39;d&#39;] undefined 4"
        ],
        "correct": 2,
        "explanation": "Оператор <b>delete</b> удаляет свойства объекта, но не индексы массива. Точнее, удаляется только значение массива по указанному индексу, сам индекс остается, его значением становится <b>undefined</b>. При этом, количество элементов в массиве и его длина сохраняются."
    },
    {
        "id": 142,
        "question": "const obj = {\r\n  prop1: function() { return 0 },\r\n  prop2() { return 1 },\r\n  [&#39;prop&#39; + 3]() { return 2 }\r\n}\r\n\r\nconsole.log(obj.prop1())\r\nconsole.log(obj.prop2())\r\nconsole.log(obj.prop3())",
        "options": [
            "0 1 2",
            "0 { return 1 } 2",
            "0 { return 1 } { return 2 }",
            "0 1 undefined"
        ],
        "correct": 0,
        "explanation": "<b>ES6</b>, среди прочего, представил новые способы определения методов и сокращения свойств объекта. Поэтому <b>prop2</b> и <b>prop3</b> обрабатываются как обычные функции."
    },
    {
        "id": 143,
        "question": "console.log(1 &lt; 2 &lt; 3)\r\nconsole.log(3 &gt; 2 &gt; 1)",
        "options": [
            "true true",
            "true false",
            "ошибка",
            "false false"
        ],
        "correct": 1,
        "explanation": "Если в блоке <b>if</b> содержатся одинаковые операторы, то выражение оценивается слева направо. Для первого выражения порядок будет следующим:\r\n\r\nconsole.log(1 &lt; 2 &lt; 3)\r\nconsole.log(true &lt; 3)\r\nconsole.log(1 &lt; 3) // true\r\n\r\nА для второго таким:\r\n\r\nconsole.log(3 &gt; 2 &gt; 1)\r\nconsole.log(true &gt; 1)\r\nconsole.log(1 &gt; 1) // false"
    },
    {
        "id": 144,
        "question": "// обратите внимание: код выполняется в нестрогом режиме\r\nfunction printNumbers (first, second, first) {\r\n  console.log(first, second, first)\r\n}\r\nprintNumbers(1, 2, 3)",
        "options": [
            "1 2 3",
            "3 2 3",
            "ошибка",
            "1 2 1"
        ],
        "correct": 1,
        "explanation": "В нестрогом режиме дублирующиеся параметры в обычных функциях разрешены. В приведенном примере дублирующимися являются параметры <b>1</b> и <b>3</b> (<b>first</b>). Первый параметр указывает на третий аргумент, передаваемый функции. Поэтому третий аргумент перезаписывает первый параметр. Обратите внимание, что в строгом режиме будет выброшено исключение."
    },
    {
        "id": 145,
        "question": "// обратите внимание: код выполняется в нестрогом режиме\r\nconst printNumbersArrow = (first, second, first) =&gt; {\r\n  console.log(first, second, first)\r\n}\r\nprintNumbersArrow(1, 2, 3)",
        "options": [
            "1 2 3",
            "3 2 3",
            "ошибка",
            "1 2 1"
        ],
        "correct": 2,
        "explanation": "В отличие от обычных, в стрелочных функциях дублирующиеся параметры запрещены, независимо от режима выполнения кода. Поэтому в данном случае будет выброшено исключение <b>SyntaxError: Duplicate parameter name not allowed in this context</b> (дублирующиеся названия параметров в данном контексте запрещены)."
    },
    {
        "id": 146,
        "question": "const f = () =&gt; arguments.length\r\nconsole.log(f(1, 2, 3))",
        "options": [
            "ошибка",
            "3",
            "undefined",
            "null"
        ],
        "correct": 0,
        "explanation": "Стрелочные функции не имеют <b>arguments</b>, <b>this</b>, <b>super</b> и <b>new.target</b>. Поэтому любое обращение к <b>arguments</b> приводит к поиску переменной с таким названием в лексическом (внешнем) окружении функции. В данном случае переменной <b>arguments</b> в коде не существует. Поэтому возникает ошибка.\r\nВ обычных функциях <b>arguments</b> - это массивоподобный объект, содержащий переданные функции аргументы:\r\n\r\nconst f = function () { return arguments.length }\r\nconsole.log(f(1, 2, 3)) // 3\r\n\r\nВ стрелочных функциях альтернативой <b>arguments</b> является rest-оператор <b>...</b> (прочие параметры):\r\n\r\nconst f = (...args) =&gt; args.length\r\nconsole.log(f(1, 2, 3)) // 3"
    },
    {
        "id": 147,
        "question": "console.log( String.prototype.trimLeft.name === &#39;trimLeft&#39; )\r\nconsole.log( String.prototype.trimLeft.name === &#39;trimStart&#39; )",
        "options": [
            "true false",
            "false true",
            "undefined",
            "null"
        ],
        "correct": 1,
        "explanation": "По аналогии с <b>String.prototype.padStart</b> встроенный метод для удаления пробелов в начале строки был назван <b>trimStart</b>. Однако для обеспечения обратной совместимости название <b>trimLeft</b> было сохранено в качестве синонима (alias) для <b>trimStart</b>. При этом, прототипом <b>trimLeft</b> является <b>trimStart</b>."
    },
    {
        "id": 148,
        "question": "console.log(Math.max())",
        "options": [
            "undefined",
            "Infinity",
            "0",
            "-Infinity"
        ],
        "correct": 3,
        "explanation": "<b>-Infinity</b> - это наименьшее из сравниваемых значений, поскольку почти любое другое значение в <b>JavaScript</b> больше него. Поэтому, когда <b>Math.max()</b> вызывается без аргументов, возвращается <b>-Infinity</b>."
    },
    {
        "id": 149,
        "question": "console.log(10 == [10])\r\nconsole.log(10 == [[[[[[[10]]]]]]])",
        "options": [
            "true true",
            "true false",
            "false false",
            "false true"
        ],
        "correct": 0,
        "explanation": "Согласно спецификации <b>ECMAScript</b> приведенные выражения будут преобразованы следующим образом:\r\n\r\n10 == Number([10].valueOf().toString()) // 10\r\n\r\nПоэтому количество скобок значения не имеет."
    },
    {
        "id": 150,
        "question": "console.log(10 + &#39;10&#39;)\r\nconsole.log(10 - &#39;10&#39;)",
        "options": [
            "20 0",
            "1010 0",
            "1010 10-10",
            "NaN NaN"
        ],
        "correct": 1,
        "explanation": "Оператор <b>+</b> применяется как к числам, так и к строкам. Если одним из операндов является строка, второй операнд также приводится к строке, и операнды объединяются. Это называется конкатенацией. Оператор <b>-</b> пытается преобразовать операнд в число. При невозможности это сделать возвращается <b>NaN</b>."
    },
    {
        "id": 151,
        "question": "console.log([1, 2] + [3, 4])",
        "options": [
            "[1, 2, 3, 4]",
            "&#39;[1, 2][3, 4]&#39;",
            "ошибка",
            "&#39;1,23,4&#39;"
        ],
        "correct": 3,
        "explanation": "Оператор <b>+</b> не предназначен для сложения массивов. Поэтому массивы преобразуются в строки и объединяются."
    },
    {
        "id": 152,
        "question": "const numbers = new Set([1, 1, 2, 3, 4])\r\nconsole.log(numbers)\r\n\r\nconst browser = new Set(&#39;Firefox&#39;)\r\nconsole.log(browser)",
        "options": [
            "{ 1, 2, 3, 4 } и { &quot;F&quot;, &quot;i&quot;, &quot;r&quot;, &quot;e&quot;, &quot;f&quot;, &quot;o&quot;, &quot;x&quot; }",
            "{ 1, 2, 3, 4 } и { &quot;F&quot;, &quot;i&quot;, &quot;r&quot;, &quot;e&quot;, &quot;o&quot;, &quot;x&quot; }",
            "[1, 2, 3, 4] и [&quot;F&quot;, &quot;i&quot;, &quot;r&quot;, &quot;e&quot;, &quot;o&quot;, &quot;x&quot;]",
            "{ 1, 1, 2, 3, 4 } и { &quot;F&quot;, &quot;i&quot;, &quot;r&quot;, &quot;e&quot;, &quot;f&quot;, &quot;o&quot;, &quot;x&quot; }"
        ],
        "correct": 0,
        "explanation": "<b>Set</b> - это объект, представляющий собой коллекцию уникальных значений, поэтому повторяющиеся значения в него не включаются. В то же время, данный объект является чувствительным к регистру, поэтому в коллекцию записываются как <b>F</b>, так и <b>f</b>."
    },
    {
        "id": 153,
        "question": "console.log(NaN === NaN)",
        "options": [
            "true",
            "false",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "<b>NaN</b> согласно стандарту <b>IEEE 754</b> не равен никакому другому значению, включая <b>NaN</b>. Еще одной интересной особенностью <b>NaN</b> является то, что данное значение представляет собой неправильное, но все-таки число, несмотря на то, что <b>NaN</b> расшифровывается как <b>Not a Number</b> (не число). Для того, чтобы убедиться в том, что <b>NaN</b> - это число, выполните <b>console.log(typeof NaN)</b>."
    },
    {
        "id": 154,
        "question": "const numbers = [1, 2, 3, 4, NaN]\r\nconsole.log(numbers.indexOf(NaN))",
        "options": [
            "4",
            "NaN",
            "ошибка",
            "-1"
        ],
        "correct": 3,
        "explanation": "<b>indexOf()</b> использует оператор строгого равенства или проверки на идентичность (<b>===</b>), а поскольку <b>NaN</b> не равен никакому другому значению, включая <b>NaN</b>, выражение <b>NaN === NaN</b> возвращает <b>false</b>. <b>indexOf()</b> не может найти <b>NaN</b> в массиве - возвращается <b>-1</b>. Для поиска индекса <b>NaN</b> можно использовать метод <b>findIndex</b>. Также для проверки наличия <b>NaN</b> в массиве можно использовать метод <b>includes</b>:\r\n\r\nconst numbers = [1, 2, 3, 4, NaN]\r\nconsole.log(numbers.findIndex(Number.isNaN)) // 4\r\nconsole.log(numbers.includes(Number.isNaN)) // true"
    },
    {
        "id": 155,
        "question": "const [a, ...b,] = [1, 2, 3, 4, 5]\r\nconsole.log(a, b)",
        "options": [
            "1 [2, 3, 4, 5]",
            "1 {2, 3, 4, 5}",
            "ошибка",
            "1 [2, 3, 4]"
        ],
        "correct": 2,
        "explanation": "При использовании rest-оператора <b>...</b> (прочие параметры), он передается в качестве последнего аргумента. В данном случае использование замыкающей запятой (trailing comma) приводит к возникновению ошибки. Если убрать запятую, то все будет в порядке:\r\n\r\nconst [a, ...b] = [1, 2, 3, 4, 5]\r\nconsole.log(a, b) // 1 [2, 3, 4, 5]"
    },
    {
        "id": 156,
        "question": "async function func() {\r\n  return 10\r\n}\r\nconsole.log(func())",
        "options": [
            "Promise {:10}",
            "10",
            "ошибка",
            "Promise {:undefined}"
        ],
        "correct": 0,
        "explanation": "Асинхронная функция всегда возвращает промис. Даже если возвращаемое такой функцией значение само по себе не является промисом, оно будет &quot;завернуто&quot; в промис. Приведенный пример эквивалентен следующему:\r\n\r\nfunction func() { return Promise.resolve(10) }"
    },
    {
        "id": 157,
        "question": "async function func() {\r\n  await 10\r\n}\r\nconsole.log(func())",
        "options": [
            "Promise {:10}",
            "10",
            "ошибка",
            "Promise {:undefined}"
        ],
        "correct": 3,
        "explanation": "<b>await</b> возвращает <b>Promise {:10}</b>, который может быть обработан с помощью <b>then</b>. В данном случае функция не содержит оператора <b>return</b>, т.е. не возвращает никакого значение в явном виде. Поэтому возвращается <b>undefined</b>. Приведенный код эквивалентен следующему:\r\n\r\nfunction func () { return Promise.resolve(10).then(() =&gt; undefined) }"
    },
    {
        "id": 158,
        "question": "function delay() {\r\n  return new Promise(resolve =&gt; setTimeout(resolve, 2000))\r\n}\r\n\r\nasync function delayedLog(item) {\r\n  await delay()\r\n  console.log(item)\r\n}\r\n\r\nasync function processArray(array) {\r\n  array.forEach(item =&gt; {\r\n    await delayedLog(item)\r\n  })\r\n}\r\n\r\nprocessArray([1, 2, 3, 4])",
        "options": [
            "ошибка",
            "1, 2, 3, 4",
            "4, 4, 4, 4",
            "4, 3, 2, 1"
        ],
        "correct": 0,
        "explanation": "Несмотря на то, что <b>processArray</b> - это асинхронная функция, анонимная функция, которую мы используем в <b>forEach()</b>, является синхронной. Использование ключевого слова <b>await</b> в синхронных функциях приводит к тому, что выбрасывается исключение <b>SyntaxError: await is only valid in async function</b> (ключевое слово <b>await</b> валидно только в асинхронных функциях)."
    },
    {
        "id": 159,
        "question": "function delay() {\r\n  return new Promise(resolve =&gt; setTimeout(resolve, 2000))\r\n}\r\n\r\nasync function delayedLog(item) {\r\n  await delay()\r\n  console.log(item)\r\n}\r\n\r\nasync function process(array) {\r\n  array.forEach(async (item) =&gt; {\r\n    await delayedLog(i)\r\n  })\r\n  console.log(&#39;Process completed!&#39;)\r\n}\r\n\r\nprocess([1, 2, 3, 5])",
        "options": [
            "1 2 3 5 и Process completed!",
            "5 5 5 5 и Process completed!",
            "Process completed! и 5 5 5 5",
            "Process completed! и 1 2 3 5"
        ],
        "correct": 3,
        "explanation": "Метод <b>forEach</b> не ожидает завершения операции, он лишь запускает ее выполнение и двигается дальше. Поэтому <b>console.log(&#39;Process finished!&#39;)</b> выполняется первым согласно последовательности разрешения промисов. Определить нужную последовательность можно с помощью оператора <b>for-of</b> и ключевого слова <b>await</b>:\r\n\r\nasync function processArray(array) {\r\n  for (const item of array) {\r\n    await delayedLog(item)\r\n  }\r\n  console.log(&#39;Process completed!&#39;)\r\n}"
    },
    {
        "id": 160,
        "question": "var set = new Set()\r\nset.add(&quot;+0&quot;)\r\n  .add(&quot;-0&quot;)\r\n    .add(NaN)\r\n        .add(undefined)\r\n            .add(NaN)\r\n\r\nconsole.log(set)",
        "options": [
            "Set(4) { &quot;+0&quot;, &quot;-0&quot;, NaN, undefined }",
            "Set(3) { &quot;+0&quot;, NaN, undefined }",
            "Set(5) { &quot;+0&quot;, &quot;-0&quot;, NaN, undefined, NaN }",
            "Set(4) { &quot;+0&quot;, NaN, undefined, NaN }"
        ],
        "correct": 0,
        "explanation": "В отличии от операторов равенства (<b>==</b> и <b>===</b>), для <b>Set</b> все <b>NaN</b> являются одинаковыми значениями, а <b>+0</b> и <b>-0</b> - разными."
    },
    {
        "id": 161,
        "question": "const sym1 = Symbol(&#39;one&#39;)\r\nconst sym2 = Symbol(&#39;one&#39;)\r\n\r\nconst sym3 = Symbol.for(&#39;two&#39;)\r\nconst sym4 = Symbol.for(&#39;two&#39;)\r\n\r\nconsole.log(sym1 === sym2, sym3 === sym4)",
        "options": [
            "true true",
            "true false",
            "false true",
            "false false"
        ],
        "correct": 2,
        "explanation": "Для символом характерно следующее:\r\n1. Каждый символ, возвращаемый <b>Symbol()</b>, это уникальное значение. Строка, передаваемая <b>Symbol()</b>, это всего лишь опциональная метка или описание символа, которая обычно используется для отладки кода.\r\n2. Метод <b>Symbol.for</b> создает символ в глобальном реестре символов. При каждом вызове данного метода проверяется, имеется ли символ с указанным ключом в реестре. После этого либо возвращается найденный символ, либо создается новый."
    },
    {
        "id": 162,
        "question": "const sym1 = new Symbol(&#39;one&#39;)\r\nconsole.log(sym1)",
        "options": [
            "ошибка",
            "one",
            "Symbol(&#39;one&#39;)",
            "Symbol"
        ],
        "correct": 0,
        "explanation": "<b>Symbol</b> - это обычная функция, а не конструктор, в отличие, например, от <b>Number</b> или <b>String</b>. Поэтому при попытке использования его с ключевым словом <b>new</b> выбрасывается исключение <b>TypeError: Symbol is not a constructor</b> (<b>Symbol</b> не является конструктором)."
    },
    {
        "id": 163,
        "question": "let myNumber = 100\r\nlet myString = &quot;100&quot;\r\n\r\nif (!typeof myNumber === &quot;string&quot;) {\r\n  console.log(&quot;It is not a string!&quot;)\r\n} else {\r\n  console.log(&quot;It is a string!&quot;)\r\n}\r\n\r\nif (!typeof myString === &quot;number&quot;){\r\n  console.log(&quot;It is not a number!&quot;)\r\n} else {\r\n  console.log(&quot;It is a number!&quot;)\r\n}",
        "options": [
            "ошибка",
            "It is not a string! и It is not a number!",
            "It is not a string! и It is a number!",
            "It is a string! и It is a number!"
        ],
        "correct": 3,
        "explanation": "Оператор <b>!</b> приводит значение к логическому типу и инвертирует его. Поскольку выражения <b>typeof myNumber</b> и <b>typeof myString</b> истинные, в обоих случаях возвращается <b>false</b>. Далее выполняются блоки <b>else</b>."
    },
    {
        "id": 164,
        "question": "console.log(JSON.stringify({ myArray: [&#39;one&#39;, undefined, function() {}, Symbol(&#39;&#39;)] }))\r\nconsole.log(JSON.stringify({ [Symbol.for(&#39;one&#39;)]: &#39;one&#39; }, [Symbol.for(&#39;one&#39;)]))",
        "options": [
            "{ &quot;myArray&quot;:[&#39;one&#39;, undefined, {}, Symbol] } и {}",
            "{ &quot;myArray&quot;:[&#39;one&#39;, null, null, null] } и {}",
            "{ &quot;myArray&quot;:[&#39;one&#39;, null, null, null] } и &quot;{ [Symbol.for(&#39;one&#39;)]: &#39;one&#39; }, [Symbol.for(&#39;one&#39;)]&quot;",
            "{ &quot;myArray&quot;:[&#39;one&#39;, undefined, function(){}, Symbol(&#39;&#39;)] } и {}"
        ],
        "correct": 1,
        "explanation": "<b>undefined</b>, функции и символы не являются валидными <b>JSON-значениями</b>. Такие значения не включаются в объект и конвертируются (преобразуются) в <b>null</b>. Поэтому возвращается <b>null, null, null</b>. Глобальные символы игнорируются, поэтому возвращается пустой объект (<b>{}</b>)."
    },
    {
        "id": 165,
        "question": "class A {\r\n  constructor() {\r\n    console.log(new.target.name)\r\n  }\r\n}\r\n\r\nclass B extends A { constructor() { super() } }\r\n\r\nnew A()\r\nnew B()",
        "options": [
            "A A",
            "A B",
            "B B",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "<b>new.target</b> ссылается на конструктор (указывает на класс), который вызывается с помощью ключевого слова <b>new</b>. Это также справедливо для конструктора родительского класса, вызываемого из подкласса."
    },
    {
        "id": 166,
        "question": "const { a: x = 10, b: y = 20 } = { a: 30 }\r\n\r\nconsole.log(x)\r\nconsole.log(y)",
        "options": [
            "30 20",
            "10 20",
            "10 undefined",
            "30 undefined"
        ],
        "correct": 0,
        "explanation": "Для свойств объекта характерно следующее:\r\n1. Значение свойства (<b>30</b>) может быть извлечено и присвоено переменной (<b>x</b>).\r\n2. Свойству присваивается значение по умолчанию (<b>20</b>), когда извлекаемым значением является <b>undefined</b> (<b>y</b>)."
    },
    {
        "id": 167,
        "question": "function area({ length = 10, width = 20 }) {\r\n  console.log(length * width)\r\n}\r\n\r\narea()",
        "options": [
            "200",
            "ошибка",
            "undefined",
            "0"
        ],
        "correct": 1,
        "explanation": "Здесь мы имеем дело с деструктуризацией объекта. Если опустить правую часть выражения, функция при вызове попытается найти хотя бы один аргумент. Если ей не удастся этого сделать, будет выброшено исключение <b>TypeError: Cannot read property &#39;length&#39; of undefined</b> (невозможно прочитать свойство <b>length</b> неопределенного значения). Решить данную проблему можно следующими способами:\r\n1. Передать функции пустой объект (<b>{}</b>) в качестве аргумента:\r\n\r\nfunction area ({ length = 10, width = 20 }) { console.log(length * width) }\r\narea({}) // 200\r\n\r\n2. Присвоить пустой объект в качестве значения аргумента по умолчанию:\r\n\r\nfunction area ({ length = 10, width = 20 } = {}) { console.log(length * width) }\r\narea() // 200"
    },
    {
        "id": 168,
        "question": "const props = [\r\n  { id: 1, name: &#39;John&#39;},\r\n  { id: 2, name: &#39;Jane&#39;},\r\n  { id: 3, name: &#39;Bob&#39;}\r\n]\r\n\r\nconst [, , { name }] = props\r\nconsole.log(name)",
        "options": [
            "Bob",
            "ошибка",
            "undefined",
            "John"
        ],
        "correct": 0,
        "explanation": "Деструктуризацию массива и объекта можно комбинировать. В данном случае переменной <b>name</b> присваивается значение соответствующего свойства третьего элемента массива <b>props</b>."
    },
    {
        "id": 169,
        "question": "function checkType(num = 1) {\r\n  console.log(typeof num)\r\n}\r\n\r\ncheckType()\r\ncheckType(undefined)\r\ncheckType(&#39;&#39;)\r\ncheckType(null)",
        "options": [
            "number undefined string object",
            "undefined undefined string object",
            "number number string object",
            "number number number number"
        ],
        "correct": 2,
        "explanation": "Если функции не передается значение или передается <b>undefined</b>, аргумент принимает значение по умолчанию (<b>1</b>). Другие ложные значения (<b>&quot;&quot;</b> и <b>null</b>) присваиваются аргументу.\r\nПервые два вызова функции <b>checkType</b> возвращают <b>number</b>, поскольку значением аргумента является <b>1</b>.\r\nТипом пустой строки (<b>&quot;&quot;</b>) является <b>string</b>, а типом <b>null</b> - <b>object</b>."
    },
    {
        "id": 170,
        "question": "function add(item, items = []) {\r\n  items.push(item)\r\n  return items\r\n}\r\n\r\nconsole.log(add(&#39;Orange&#39;))\r\nconsole.log(add(&#39;Apple&#39;))",
        "options": [
            "[&#39;Orange&#39;] и [&#39;Orange&#39;, &#39;Apple&#39;]",
            "[&#39;Orange&#39;] и [&#39;Apple&#39;]",
            "[]",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Аргументу <b>items</b> при каждом вызове функции <b>add</b> присваивается пустой массив (значение по умолчанию), который возвращается с помещенным в него значением аргумента <b>item</b>."
    },
    {
        "id": 171,
        "question": "function greet(greeting, name, message = greeting + &#39; &#39; + name) {\r\n  console.log([greeting, name, message])\r\n}\r\n\r\ngreet(&#39;Hello&#39;, &#39;John&#39;)\r\ngreet(&#39;Hello&#39;, &#39;John&#39;, &#39;Good morning!&#39;)",
        "options": [
            "ошибка",
            "[&#39;Hello&#39;, &#39;John&#39;, &#39;Hello John&#39;] и [&#39;Hello&#39;, &#39;John&#39;, &#39;Good morning!&#39;]",
            "[&#39;Hello&#39;, &#39;John&#39;, &#39;Hello John&#39;] и [&#39;Hello&#39;, &#39;John&#39;, &#39;Hello John&#39;]",
            "undefined"
        ],
        "correct": 1,
        "explanation": "При первом вызове функции <b>greet</b> аргументу <b>message</b> присваивается значение по умолчанию (<b>greeting + &#39; &#39; + name</b>). При втором вызове данному аргументу присваивается переданное значение (<b>Good morning!</b>)."
    },
    {
        "id": 172,
        "question": "function outer(f = inner()) {\r\n  function inner() { return &#39;Inner&#39; }\r\n}\r\nconsole.log(outer())",
        "options": [
            "ошибка",
            "Inner",
            "Inner Inner",
            "undefined"
        ],
        "correct": 0,
        "explanation": "Функции и переменные, объявленные в теле функции, не могут использоваться в качестве значений по умолчанию, поэтому выбрасывается исключение <b>ReferenceError: inner is not defined</b> (переменная <b>inner</b> не определена). Для того, чтобы сделать функцию работоспособной, ее можно переписать так:\r\n\r\nfunction outer (f) { function inner () { return &#39;Inner&#39; }; const fun = f || inner(); return fun }\r\nconsole.log(outer()) // Inner\r\nconsole.log(outer(&#39;Outer&#39;)) // Outer\r\nИли так:\r\nconst outer = (msg = &#39;Inner&#39;) =&gt; msg\r\nconsole.log(outer()) // Inner\r\nconsole.log(outer(&#39;Outer&#39;)) // Outer"
    },
    {
        "id": 173,
        "question": "function myFun(x, y, ...args) {\r\n  console.log(args)\r\n}\r\n\r\nmyFun(1, 2, 3, 4, 5)\r\nmyFun(1, 2)",
        "options": [
            "[3, 4, 5] и undefined",
            "ошибка",
            "[3, 4, 5] и []",
            "[3, 4, 5] и [undefined]"
        ],
        "correct": 2,
        "explanation": "Оператор rest (прочие параметры, <b>...</b>) возвращает массив с переданными функции неименованными аргументами или пустой массив в случае, когда такие аргументы отсутствуют."
    },
    {
        "id": 174,
        "question": "const obj = {&#39;key&#39;: &#39;value&#39;}\r\nconst array = [...obj]\r\nconsole.log(array)",
        "options": [
            "[&#39;key&#39;, &#39;value&#39;]",
            "ошибка",
            "[]",
            "[&#39;key&#39;]"
        ],
        "correct": 1,
        "explanation": "Оператор spread (распространения или распаковки, <b>...</b>) применяется только к итерируемым (перебираемым) сущностям. Объекты таковыми не являются. Поэтому выбрасывается исключение <b>TypeError: object is not iterable</b> (объекты не являются итерируемыми сущностями)."
    },
    {
        "id": 175,
        "question": "function* myGenFunc() {\r\n  yield 1\r\n  yield 2\r\n  yield 3\r\n}\r\nvar myGenObj = new myGenFunc\r\nconsole.log(myGenObj.next().value)",
        "options": [
            "1",
            "undefined",
            "2",
            "ошибка"
        ],
        "correct": 3,
        "explanation": "Генераторы (функции со специальным символом <b>*</b> после названия) не могут использоваться в качестве конструкторов, т.е. с ключевым словом <b>new</b>, поэтому выбрасывается исключение <b>TypeError: myGenFunc is not a constructor</b> (<b>myGenFunc</b> не является конструктором)."
    },
    {
        "id": 176,
        "question": "function* yieldAndReturn() {\r\n  yield 1\r\n  return 2\r\n  yield 3\r\n}\r\n\r\nvar myGenObj = yieldAndReturn()\r\nconsole.log(myGenObj.next())\r\nconsole.log(myGenObj.next())\r\nconsole.log(myGenObj.next())",
        "options": [
            "{ value: 1, done: false }  { value: 2, done: true }  { value: undefined, done: true }",
            "{ value: 1, done: false }  { value: 2, done: false }  { value: undefined, done: true }",
            "{ value: 1, done: false }  { value: 2, done: true }  { value: 3, done: true }",
            "{ value: 1, done: false }  { value: 2, done: false }  { value: 3, done: true }"
        ],
        "correct": 0,
        "explanation": "Инструкция <b>return</b> в генераторе (функция со специальным символом <b>*</b> после названия) останавливает его выполнение. Возвращаемое значение <b>2</b> присваивается свойству <b>value</b>, а значением свойства <b>done</b> становится <b>true</b>. После завершения работы генератора вызов метода <b>next</b> возвращает <b>{ value: undefined, done: true }</b>."
    },
    {
        "id": 177,
        "question": "const myGenerator = (function *(){\r\n  yield 1\r\n  yield 2\r\n  yield 3\r\n})()\r\n\r\nfor (const value of myGenerator) {\r\n  console.log(value)\r\n  break\r\n}\r\n\r\nfor (const value of myGenerator) {\r\n  console.log(value)\r\n}",
        "options": [
            "1 2 3 и 1 2 3",
            "1 2 3 и 4 5 6",
            "1 1",
            "1"
        ],
        "correct": 3,
        "explanation": "Генератор (функция со специальным символом <b>*</b> после названия) не может использоваться после закрытия итератора. В первом цикле мы с помощью оператора <b>break</b> останавливаем выполнение генератора со значением <b>1</b>. Повторный перебор генератора невозможен, поэтому второй <b>console.log()</b> ничего не выводит в консоль."
    },
    {
        "id": 178,
        "question": "const squareObj = new Square(10)\r\nconsole.log(squareObj.area)\r\n\r\nclass Square {\r\n  constructor(length) {\r\n    this.length = length\r\n  }\r\n\r\n  get area() {\r\n    return this.length * this.length\r\n  }\r\n\r\n  set area(value) {\r\n    this.area = value\r\n  }\r\n}",
        "options": [
            "100",
            "ошибка",
            "10",
            "undefined"
        ],
        "correct": 1,
        "explanation": "В отличие от объявлений функций (но не функциональных выражений), объявления классов не поднимаются в начало области видимости. Это также справедливо для выражений класса. Поэтому использовать класс можно только после его объявления, в противном случае, выбрасывается исключение <b>ReferenceError: Square is not defined</b> (переменная <b>Square</b> не определена)."
    },
    {
        "id": 179,
        "question": "function Person() { }\r\n\r\nPerson.prototype.walk = function() {\r\n  return this\r\n}\r\n\r\nPerson.run = function() {\r\n  return this\r\n}\r\n\r\nlet user = new Person()\r\nlet walk = user.walk\r\nconsole.log(walk())\r\n\r\nlet run = Person.run\r\nconsole.log(run())",
        "options": [
            "undefined undefined",
            "Person Person",
            "ошибка",
            "Window Window"
        ],
        "correct": 3,
        "explanation": "Когда обычный метод или метод прототипа вызывается без передачи ему значения <b>this</b>, метод возвращает значение <b>this</b> по умолчанию. В данном случае таким значением является глобальный объект (<b>window</b> в браузере, <b>global</b> в <b>Node.js</b>)."
    },
    {
        "id": 180,
        "question": "class Vehicle {\r\n  constructor(name) {\r\n    this.name = name\r\n  }\r\n\r\n  start() {\r\n    console.log(`${this.name} vehicle started`)\r\n  }\r\n}\r\n\r\nclass Car extends Vehicle {\r\n  start() {\r\n    console.log(`${this.name} car started`)\r\n    super.start()\r\n  }\r\n}\r\n\r\nconst car = new Car(&#39;BMW&#39;)\r\nconsole.log(car.start())",
        "options": [
            "ошибка",
            "BMW vehicle started и BMW car started",
            "BMW car started и BMW vehicle started",
            "BMW car started и BMW car started"
        ],
        "correct": 2,
        "explanation": "Ключевое слово <b>super</b> используется, в том числе, для вызова методов родительского класса. В отличие от других языков программирования, в <b>JavaScript</b> вызов <b>super()</b> не обязательно должен быть первой инструкцией."
    },
    {
        "id": 181,
        "question": "const user = {&#39;age&#39;: 30}\r\nuser.age = 25\r\nconsole.log(user.age)",
        "options": [
            "30",
            "25",
            "ошибка",
            "undefined"
        ],
        "correct": 1,
        "explanation": "Мы используем ключевое слово <b>const</b> для объявления переменной <b>user</b>, т.е. делаем ее константой (неизменяемой или неизменной). Однако иммутабельность переменной-объекта, не распространяется на ее свойства. Другими словами, свойства такого объекта можно изменять. Но если мы попытаемся присвоить переменной <b>user</b> новое значение (<b>user = {&#39;age&#39;: 25}</b>), будет выброшено исключение <b>TypeError: Assignment to constant variable</b>. Для обеспечения иммутабельности свойств объекта можно использовать метод <b>freeze</b>.\r\nМы используем ключевое слово <b>const</b> для объявления переменной <b>user</b>, т.е. делаем ее константой (неизменяемой или неизменной). Однако иммутабельность переменной-объекта, не распространяется на ее свойства. Другими словами, свойства такого объекта можно изменять. Но если мы попытаемся присвоить переменной <b>user</b> новое значение (<b>user = {&#39;age&#39;: 25}</b>), будет выброшено исключение <b>TypeError: Assignment to constant variable</b> (попытка присвоения значения константной переменной). Для обеспечения иммутабельности свойств объекта можно использовать <b>Object.freeze()</b>."
    },
    {
        "id": 182,
        "question": "function a(x) {\r\n  x++\r\n  return function () {\r\n    console.log(++x)\r\n  }\r\n}\r\n\r\na(1)()\r\na(1)()\r\na(1)()\r\n\r\nlet x = a(1)\r\nx()\r\nx()\r\nx()",
        "options": [
            "1 2 3 и 1 2 3",
            "3 3 3 и 3 4 5",
            "3 3 3 и 1 2 3",
            "1 2 3 и 3 3 3"
        ],
        "correct": 1,
        "explanation": "Здесь мы имеем дело с замыканием. Замыкания позволяют нам создавать статические функции, которым доступны переменные из внешнего окружения. Другими словами, замыкание имеет доступ к глобальной области видимости, области видимости родительской функции и собственной области видимости.\r\nМы получаем <b>3 3 3</b> и <b>3 4 5</b>, поскольку сначала просто вызываем функцию <b>a</b>. Она работает как обычная функция. Затем мы объявляем переменную <b>x</b> и присваиваем ей значение функции <b>a(1)</b>, вот почему мы получаем <b>3 4 5</b> вместо <b>3 3 3</b>."
    },
    {
        "id": 183,
        "question": "function Name(a, b) {\r\n  this.a = a\r\n  this.b = b\r\n}\r\n\r\nconst me = Name(&#39;John&#39;, &#39;Smith&#39;)\r\n\r\nconsole.log(!(a.length - window.a.length))",
        "options": [
            "undefined",
            "NaN",
            "true",
            "false"
        ],
        "correct": 2,
        "explanation": "Мы получаем <b>true</b>. Обратите внимание, что при создании объекта с помощью функции-конструктора <b>Name</b> мы не использовали ключевое слово <b>new</b>. Из-за этого переменная <b>a</b> стала глобальной и получила значение <b>John</b>. В действительности, глобальные переменные - это свойства глобального объекта (<b>window</b> в браузере или <b>global</b> в <b>Node.js</b>). Поэтому выражение <b>a.length - window.a.length</b> возвращает <b>0</b>, а <b>!0</b> возвращает <b>true</b>."
    },
    {
        "id": 184,
        "question": "const x = function (...x) {\r\n  let k = (typeof x).length\r\n  let y = () =&gt; &quot;freetut&quot;.length\r\n  let z = { y: y }\r\n\r\n  return k - z.y()\r\n}\r\n\r\nconsole.log(Boolean(x()))",
        "options": [
            "true",
            "1",
            "-1",
            "false"
        ],
        "correct": 0,
        "explanation": "Spread-оператор <b>...x</b> позволяет получить параметры функции в виде массива. Выражение <b>typeof array</b> возвращает <b>object</b>. Длина строки <b>object</b> равняется <b>6</b>. <b>z.y()</b> возвращает длину строки <b>freetut</b>, т.е. <b>7</b>. Функциональное выражение <b>x</b> возвращает <b>-1</b>, которое после преобразования в логический тип становится <b>true</b>. Обратите внимание, что <b>Boolean(0)</b> вернет <b>false</b>."
    },
    {
        "id": 185,
        "question": "(function js(x) {\r\n  const y = (j) =&gt; j * x\r\n\r\n  console.log(y(s()))\r\n\r\n  function s() {\r\n    return j()\r\n  }\r\n\r\n  function j() {\r\n    return x ** x\r\n  }\r\n})(3)",
        "options": [
            "undefined",
            "18",
            "81",
            "12"
        ],
        "correct": 2,
        "explanation": "Функция <b>js</b> выполняется автоматически, поскольку является IIFE (Immediately Invoked Function Expression - немедленно вызываемым функциональным выражением). Аргумент <b>x</b> передается <b>js()</b> со значением <b>3</b>. Значение, возвращаемое функцией <b>y(s())</b>, означает вызов трех функций: <b>y</b>, <b>s</b> и <b>j</b>, поскольку <b>s()</b> возвращает <b>j()</b>. <b>j()</b> возвращает <b>3 ^ 3</b>, или <b>27</b>, поэтому <b>s()</b> возвращает <b>27</b>. <b>y(s())</b> означает <b>y(27)</b>, что возвращает <b>27 * 3</b>, или <b>81</b>. Обратите внимание, что мы можем вызывать функции до их объявления, но это не работает с функциональными выражениями."
    },
    {
        "id": 186,
        "question": "var tip = 100\r\n\r\n(function () {\r\n  console.log(&quot;I have $&quot; + husband())\r\n\r\n  function wife() {\r\n    return tip * 2\r\n  }\r\n\r\n  function husband() {\r\n    return wife() / 2\r\n  }\r\n\r\n  var tip = 10\r\n})()",
        "options": [
            "I have $10",
            "I have $100",
            "I have $50",
            "I have $NaN"
        ],
        "correct": 3,
        "explanation": "Здесь мы имеем дело с IIFE (Immediately Invoked Function Expression - немедленно вызываемым функциональным выражением). IIFE выполняются автоматически. Последовательность здесь следующая: <b>husband()</b> возвращает <b>wife()</b>, а <b>wife()</b> возвращает <b>tip * 2</b>. Можно подумать, что <b>tip</b> равняется <b>100</b>, поскольку мы объявили ее с помощью ключевого слова <b>var</b> и она стала глобальной. Однако на самом деле ее значением является <b>undefined</b>, поскольку мы объявляем переменную <b>tip</b> со значением <b>10</b> внутри функции. Поскольку переменная <b>tip</b> поднимается в начало области видимости со значением <b>undefined</b>, правильным ответом является <b>D</b>. <b>undefined</b> возвращает <b>NaN</b>, когда мы пытаемся разделить его на <b>2</b> или умножить на <b>2</b>. Если убрать <b>var tip = 10</b> в конце функции, правильным ответом будет <b>B</b>."
    },
    {
        "id": 187,
        "question": "const js = { language: &quot;loosely type&quot;, label: &quot;difficult&quot; }\r\n\r\nconst edu = { ...js, level: &quot;PhD&quot; }\r\n\r\nconst newbie = edu\r\n\r\ndelete edu.language\r\n\r\nconsole.log(Object.keys(newbie).length)",
        "options": [
            "2",
            "3",
            "4",
            "5"
        ],
        "correct": 0,
        "explanation": "Данная задача посвящена spread-оператору (<b>...</b>). Этот оператор позволяет получать параметры функции, копировать или объединять объекты и массивы. В переменной <b>edu</b> мы используем оператор <b>...</b> для копирования объекта <b>js</b> и добавления к нему свойства <b>level</b>. Это также работает с массивами. Затем мы объявляем другую переменную с именем <b>newbie</b>. Важное замечание: обе переменных указывают на одно и то же место в памяти. Это называется передачей значения по ссылке. После удаления свойства <b>language</b> посредством <b>delete edu.language</b>, длина массива ключей обоих объектов становится равной <b>2</b>."
    },
    {
        "id": 188,
        "question": "var candidate = {\r\n  name: &quot;John&quot;,\r\n  age: 30\r\n}\r\n\r\nvar job = {\r\n  frontend: &quot;Vue or React&quot;,\r\n  backend: &quot;Nodejs and Express&quot;,\r\n  city: &quot;Ekaterinburg&quot;\r\n}\r\n\r\nclass Combine {\r\n  static get() {\r\n    return Object.assign(candidate, job)\r\n  }\r\n\r\n  static count() {\r\n    return Object.keys(this.get()).length\r\n  }\r\n}\r\n\r\nconsole.log(Combine.count())",
        "options": [
            "5",
            "6",
            "7",
            "8"
        ],
        "correct": 0,
        "explanation": "<b>Object.assign(candidate, job)</b> объединяет <b>candidate</b> и <b>job</b> в один объект. Затем <b>Object.keys()</b> возвращает массив ключей объекта. Обратите внимание, что методы <b>get</b> и <b>count</b> определены как статические, поэтому их можно вызывать с помощью <b>Class.staticMethodName()</b>. Результирующий объект содержит <b>5</b> ключей."
    },
    {
        "id": 189,
        "question": "var x = 1\r\n\r\n;(() =&gt; {\r\n  x += 1\r\n  ++x\r\n})()\r\n\r\n;((y) =&gt; {\r\n  x += y\r\n  x = x % y\r\n})(2)\r\n\r\n;(() =&gt; (x += x))()\r\n\r\n;(() =&gt; (x *= x))()\r\n\r\nconsole.log(x)",
        "options": [
            "4",
            "50",
            "2",
            "10"
        ],
        "correct": 0,
        "explanation": "Начальное значение переменной <b>x</b> равняется <b>1</b>. В первом IIFE (Immediately Invoked Function Expression - немедленно вызываемом функциональном выражении) значение <b>x</b> увеличивается до <b>3</b>. Во втором IIFE выражение <b>x + y (3 + 2)</b> возвращает <b>5</b>, а выражение <b>x % y (5 % 2)</b> возвращает <b>1</b>. В третьем и четвертом IIFE мы получаем <b>2</b> (<b>1 + 1</b>) и <b>4</b> (<b>2 * 2</b>), соответственно."
    },
    {
        "id": 190,
        "question": "let x = {}\r\nlet y = {}\r\nlet z = x\r\n\r\nconsole.log(x == y)\r\nconsole.log(x === y)\r\nconsole.log(x == z)\r\nconsole.log(x === z)",
        "options": [
            "true true true true",
            "false false false false",
            "true true false false",
            "false false true true"
        ],
        "correct": 3,
        "explanation": "Технически <b>x</b> и <b>y</b> имеют одинаковые значения. Обе переменные являются пустыми объектами. Однако объекты сравниваются не по значениям. <b>z</b> и <b>x</b> являются объектами, ссылающимися на одно и то же место в памяти. В <b>JavaScript</b> объекты передаются по ссылкам. Поэтому при сравнении <b>x</b> и <b>z</b> возвращается <b>true</b>."
    },
    {
        "id": 191,
        "question": "console.log(&quot;hello&quot;)\r\n\r\nsetTimeout(() =&gt; console.log(&quot;hey&quot;), 1)\r\nsetTimeout(() =&gt; console.log(&quot;yo&quot;), 2)\r\nsetTimeout(() =&gt; console.log(&quot;world&quot;), 0)\r\n\r\nconsole.log(&quot;hi&quot;)",
        "options": [
            "hello hey yo world hi",
            "hello hi hey yo world",
            "hello hi world hey yo",
            "hello hi hey world yo"
        ],
        "correct": 3,
        "explanation": "Три функции <b>setTimeout</b> помещаются в очередь задач (task queue) перед попаданием в стек вызовов (call stack), поэтому сначала в консоль выводятся <b>hello</b> и <b>hi</b>. Можно подумать, что три колбека <b>setTimeout()</b> будут выполнены в следующем порядке: <b>world -&gt; hey -&gt; yo</b> согласно временной задержке в <b>0 мс -&gt; 1 мс -&gt; 2 мс</b>, соответственно. Однако, между <b>0</b> мс и <b>1</b> мс для браузера разницы не существует. Поэтому следующим в консоль выводится <b>hey</b>, затем <b>world</b> и в конце <b>yo</b>."
    },
    {
        "id": 192,
        "question": "String.prototype.lengthy = () =&gt; {\r\n  console.log(&quot;hello&quot;)\r\n}\r\n\r\nlet x = { name: &quot;John&quot; }\r\n\r\ndelete x\r\n\r\nx.name.lengthy()",
        "options": [
            "John",
            "hello",
            "undefined",
            "ошибка"
        ],
        "correct": 1,
        "explanation": "С помощью <b>String.prototype.someThing = function() {}</b> можно определить новый встроенный метод объекта <b>String</b>. Мы можем сделать то же самое с <b>Array</b>, <b>Object</b> или <b>FunctionName</b>, где <b>FunctionName</b> - это пользовательская функция. Несложно понять, что <b>string&quot;.lengthy</b> возвращает <b>hello</b>. Оператор <b>delete</b> удаляет свойство объекта, а не сам объект. Поэтому мы получаем <b>hello</b>, а не <b>ReferenceError</b>. Обратите внимание, что если мы объявим объект без ключевых слов <b>let</b>, <b>const</b> или <b>var</b>, то получим свойство глобальный объект (<b>window</b> в браузере, <b>global</b> в <b>Node.js</b>). В этом случае выражение <b>delete objectName</b> вернет <b>true</b>."
    },
    {
        "id": 193,
        "question": "let x = {}\r\n\r\nx.__proto__.hi = 10\r\n\r\nObject.prototype.hi = ++x.hi\r\n\r\nconsole.log(x.hi + Object.keys(x).length)",
        "options": [
            "10",
            "11",
            "12",
            "NaN"
        ],
        "correct": 2,
        "explanation": "Начальным значением переменной <b>x</b> является пустой объект (<b>{}</b>). Затем мы добавляем к нему свойство <b>hi</b> со значением <b>10</b> с помощью <b>x.__proto__.hi</b>. Обратите внимание, что это эквивалентно <b>Object.prototype.hi = 10</b>, поэтому мы добавляем свойство <b>hi</b> к прототипу пустого объекта - <b>Object</b>. Это означает, что в дальнейшем любой объект будет наследовать данное свойство. Свойство <b>hi</b> становится распределенным (совместным, shared). Если мы объявим новый объект, скажем, <b>let y = {}</b>, переменная <b>y</b> унаследует свойство <b>hi</b> от <b>Object</b>. Сравнение <b>x.__proto__ === Object.prototype</b> вернет <b>true</b>. После этого, мы перезаписываем значение свойства <b>hi</b> новым значением <b>11</b>. Получаем <b>1</b> (<b>x</b> имеет одно свойство) + <b>11</b> (значение свойства <b>hi</b>), что равняется <b>12</b>."
    },
    {
        "id": 194,
        "question": "const array = (a) =&gt; {\r\n  let length = a.length\r\n  delete a[length - 1]\r\n  return a.length\r\n}\r\n\r\nconsole.log(array([1, 2, 3, 4]))\r\n\r\nconst object = (obj) =&gt; {\r\n  let key = Object.keys(obj)\r\n  let length = key.length\r\n  delete obj[key[length - 1]]\r\n\r\n  return Object.keys(obj).length\r\n}\r\n\r\nconsole.log(object({ 1: 2, 2: 3, 3: 4, 4: 5 }))\r\n\r\nconst setPropNull = (obj) =&gt; {\r\n  let key = Object.keys(obj)\r\n  let length = key.length\r\n  obj[key[length - 1]] = null\r\n\r\n  return Object.keys(obj).length\r\n}\r\n\r\nconsole.log(setPropNull({ 1: 2, 2: 3, 3: 4, 4: 5 }))",
        "options": [
            "3 3 3",
            "4 4 4",
            "4 3 4",
            "3 4 3"
        ],
        "correct": 2,
        "explanation": "Данная задача показывает, как работает оператор <b>delete</b>. Выражения <b>delete someObject</b> и <b>delete someArray</b> возвращают <b>false</b> (ничего не делают). Выражение <b>delete someObject.someProperty</b> удаляет указанное свойство объекта. В случае с массивом, выражение <b>delete someArray[keyNumber]</b> удаляет только значение указанного индекса, сам индекс остается и его новым значением становится <b>undefined</b>. По этой причине первый <b>console.log()</b> выводит <b>4</b> (массив содержит <b>4</b> элемента, последний имеет значение <b>undefined</b>), а второй - <b>3</b> (количество оставшихся свойств объекта). Последний <b>console.log()</b> выводит <b>4</b>, поскольку присвоение свойству объекта значения <b>null</b> или <b>undefined</b> не удаляет это свойство, ключ остается. Поэтому длина массива ключей объекта сохраняется."
    },
    {
        "id": 195,
        "question": "var a = [1, 2, 3]\r\nvar b = [1, 2, 3]\r\n\r\nvar c = [1, 2, 3]\r\nvar d = c\r\n\r\nvar e = [1, 2, 3]\r\nvar f = e.slice()\r\n\r\nconsole.log(a === b)\r\nconsole.log(c === d)\r\nconsole.log(e === f)",
        "options": [
            "true true true",
            "false false true",
            "true true false",
            "false true false"
        ],
        "correct": 3,
        "explanation": "Сравнение <b>a</b> и <b>b</b> возвращает <b>false</b>, поскольку эти переменные ссылаются на разные места в памяти, несмотря на то, что их значения являются одинаковыми. В <b>JavaScript</b>, в случае с объектами, значения передаются по ссылке. Во втором случае <b>d</b> является копией <b>c</b>, поэтому они ссылаются на одну и ту же область памяти. Любые изменения в <b>c</b> отражаются на <b>d</b> (и наоборот). Третий пример демонстирует способ копирования массива с помощью метода <b>slice</b>. <b>f</b> является копией <b>e</b>, но они ссылаются на разные места в памяти. Поэтому их сравнение возвращает <b>false</b>."
    },
    {
        "id": 196,
        "question": "var languages = {\r\n  name: [&quot;javascript&quot;, &quot;java&quot;, &quot;python&quot;, &quot;php&quot;, { name: &quot;feature&quot; }],\r\n  feature: &quot;awesome&quot;\r\n}\r\n\r\nlet flag = languages.hasOwnProperty(\r\n  Object.values(languages)[0][4].name\r\n)\r\n\r\n;(() =&gt; {\r\n  if (flag !== false) {\r\n    console.log(\r\n      Object.getOwnPropertyNames(languages)[0].length &lt;&lt;\r\n      Object.keys(languages)[0].length\r\n    )\r\n  } else {\r\n    console.log(\r\n      Object.getOwnPropertyNames(languages)[1].length &lt;&lt;\r\n      Object.keys(languages)[1].length\r\n    )\r\n  }\r\n})()",
        "options": [
            "8",
            "NaN",
            "64",
            "12"
        ],
        "correct": 2,
        "explanation": "Данная задача является довольно сложной, поскольку в ней встречается несколько встроенных методов для работы с объектами. Например, методы <b>keys</b> и <b>getOwnPropertyNames</b> возвращают массивы ключей (названий свойств) объекта: первый - только перечисляемые, второй - также не перечисляемые. <b>Object.values()</b> и <b>Object.keys()</b> возвращают значения и ключи объекта, соответственно. <b>Object.hasOwnProperty(&#39;propertyName&#39;)</b> возвращает логическое значение в зависимости от того, существует указанное свойство в объекте или нет. Переменная <b>language</b> имеет значение <b>true</b>, поскольку <b>Object.values(languages)[0][4].name</b> возвращает <b>feature</b>, которое является свойством объекта. Наконец, мы получаем <b>4 &lt;&lt; 4</b>, что возвращает побитовое значение, эквивалентное <b>4 * 2 ^ 4</b> или <b>4 * 16</b>, или <b>64</b>."
    },
    {
        "id": 197,
        "question": "var person = {}\r\n\r\nObject.defineProperties(person, {\r\n  name: {\r\n    value: &quot;John&quot;,\r\n    enumerable: true,\r\n  },\r\n  job: {\r\n    value: &quot;developer&quot;,\r\n    enumerable: true,\r\n  },\r\n  studying: {\r\n    value: &quot;PhD&quot;,\r\n    enumerable: true,\r\n  },\r\n  money: {\r\n    value: &quot;USD&quot;,\r\n    enumerable: false,\r\n  }\r\n})\r\n\r\nclass Evaluate {\r\n  static checkFlag(obj) {\r\n    return Object.getOwnPropertyNames(obj) &gt; Object.keys(obj)\r\n      ? Object.getOwnPropertyNames(obj)\r\n      : Object.keys(obj)\r\n  }\r\n}\r\n\r\nconst flag = Evaluate.checkFlag(person)\r\n\r\nconsole.log(flag.length)",
        "options": [
            "1",
            "2",
            "3",
            "4"
        ],
        "correct": 3,
        "explanation": "<b>Object.keys(obj)</b> почти идентичен <b>Object.getOwnPropertyNames(obj)</b>, за исключением того, что последний, кроме перечисляемых, возвращает также неперечисляемые ключи объекта. По умолчанию все свойства создаваемого объекта являются перечисляемыми. Мы можем сделать их неперечисляемыми с помощью <b>Object.defineProperty()</b> или <b>Object.defineProperties()</b> (настройка <b>enumerable: false</b>). Поэтому <b>Object.keys(person)</b> возвращает <b>3</b>, а <b>Object.getOwnPropertyNames(person)</b> - <b>4</b>. Тернарный оператор возвращает <b>4</b>."
    },
    {
        "id": 198,
        "question": "const id = 10\r\n\r\nconst getID = (...id) =&gt; {\r\n  id(id)\r\n\r\n  function id(id) {\r\n    console.log(typeof id)\r\n  }\r\n}\r\n\r\ngetID(id)",
        "options": [
            "ошибка",
            "10",
            "undefined",
            "function"
        ],
        "correct": 3,
        "explanation": "Когда мы определяем одну функцию внутри другой, то получаем замыкание (closure). Обратите внимание, если функция обычная (а не функциональное выражение), она поднимается в начало области видимости. Мы видим несколько <b>id</b> в коде, но некоторые из них ничего не делают. Результатом выполнения кода является <b>typeof id</b>, т.е. <b>function</b>. Таким образом, <b>id</b> в рассматриваемом примере является функцией."
    },
    {
        "id": 199,
        "question": "var book1 = {\r\n  name: &quot;Name of the Rose&quot;,\r\n  getName: function () {\r\n    console.log(this.name)\r\n  }\r\n}\r\n\r\nvar book2 = {\r\n  name: { value: &quot;Harry Potter&quot; }\r\n}\r\n\r\nvar bookCollection = Object.create(book1, book2)\r\n\r\nbookCollection.getName()",
        "options": [
            "Harry Potter",
            "Name of the rose",
            "ошибка",
            "Object object"
        ],
        "correct": 0,
        "explanation": "<b>Object.create()</b> позволяет создавать одни объекты на основе других. Если мы не передадим второй параметр - <b>book2</b>, в данном случае - свойство <b>name</b> объекта <b>bookCollection</b> будет иметь значение <b>Name of the Rose</b>, унаследованное от <b>book1</b>. Это означает, что мы можем добавлять новые свойства создаваемому с помощью <b>Object.create()</b> объекту. <b>bookCollection</b> имеет собственное свойство <b>name</b> и одноименное свойство, унаследованное от <b>book1</b>. Собственные свойства объекта имеют приоритет над унаследованными. Поэтому мы получаем <b>Harry Potter</b>."
    },
    {
        "id": 200,
        "question": "(() =&gt; {\r\n  const a = Object.create({})\r\n\r\n  const b = Object.create(null)\r\n\r\n  let f1 = a.hasOwnProperty(&quot;toString&quot;)\r\n\r\n  let f2 = &quot;toString&quot; in b\r\n\r\n  let result =\r\n    f1 === false &amp;&amp; f2 === false\r\n      ? console.log((typeof a.toString()).length)\r\n      : console.log(b.toString())\r\n})()",
        "options": [
            "ошибка",
            "undefined",
            "0",
            "6"
        ],
        "correct": 3,
        "explanation": "Объекты <b>a</b> и <b>b</b> создаются с помощью <b>Object.create()</b>. Разница между ними состоит в том, что <b>a</b> наследует прототип <b>Object</b>, а <b>b</b> является совершенно пустым, поскольку мы передали аргумент <b>null</b> методу <b>create</b>. <b>hasOwnProperty(&#39;toString&#39;)</b> в обоих случаях возвращает <b>false</b>, поскольку в объектах метод <b>toString</b> не определен. Однако данный метод существует в объекте <b>a</b> как унаследованный от <b>Object</b>. <b>f1</b> и <b>f2</b> возвращают <b>false</b>. Обратите внимание, что для проверки наличия свойства в объекте мы используем <b>Object.hasOwnProperty(&#39;key&#39;)</b> и <b>(&#39;key&#39; in object)</b>. Они отличаются тем, что первый возвращает только собственные свойства объекта, а второй - также унаследованные. <b>typeof a.toString()</b> возвращает <b>string</b>, длина которой равняется <b>6</b>."
    },
    {
        "id": 201,
        "question": "let promise = new Promise((rs, rj) =&gt; {\r\n  setTimeout(() =&gt; rs(4), 0)\r\n\r\n  Promise.resolve(console.log(3))\r\n\r\n  console.log(2)\r\n})\r\n\r\npromise\r\n  .then((rs) =&gt; {\r\n    console.log(rs ? rs ** rs : rs)\r\n    return rs\r\n  })\r\n  .then((rs) =&gt; console.log(rs === 256 ? rs : rs * rs))",
        "options": [
            "3 2 256 256",
            "3 2 256 16",
            "256 16 3 2",
            "16 256 3 2"
        ],
        "correct": 1,
        "explanation": "Мы определяем промис с помощью ключевого слова <b>let</b> и вызываем его. <b>setTimeout</b> - это асинхронная функция, которая выполняется последней, даже при нулевой задержке: <b>setTimeout(() =&gt; rs(4), 0)</b>. Хотя выражение <b>Promise.resolve(console.log(3))</b> также возвращает промис, он относится к микрозадачам (microtasks), которые имеет приоритет над макрозадачами (macrotasks), такими как <b>setTimeout()</b>. В первом <b>then()</b> мы получаем <b>4 ^ 4</b>, или <b>256</b>, во втором - <b>4 * 4</b>, или <b>16</b>. Обратите внимание, что <b>return rs</b> возвращает первоначальное значение."
    },
    {
        "id": 202,
        "question": "async function f() {\r\n  let promise = new Promise((resolve, reject) =&gt; {\r\n    setTimeout(() =&gt; resolve(&quot;done&quot;), 0)\r\n  })\r\n\r\n  setTimeout(() =&gt; console.log(&quot;world&quot;), 0)\r\n\r\n  console.log(await promise)\r\n\r\n  console.log(&quot;hello&quot;)\r\n}\r\n\r\nf(setTimeout(() =&gt; console.log(&quot;timer&quot;), 0))",
        "options": [
            "ошибка",
            "done hello world",
            "hello done world",
            "timer done hello world"
        ],
        "correct": 3,
        "explanation": "Хотя мы не определяем параметров в функции <b>f</b>, мы передаем ей <b>setTimeout(() =&gt; console.log(&quot;timer&quot;), 0)</b> при вызове. Поэтому сначала в консоль выводится <b>timer</b>. Переменная <b>promise</b>, возвращающая разрешенный промис, вызывается с помощью ключевого слова <b>await</b>. <b>JavaScript</b> приостанавливает выполнение кода на строке <b>console.log(await promise)</b> до разрешения промиса. Вот почему следующим мы получаем <b>done</b>. Почему вторым значением, выведенным в консоль, является <b>done</b>, а не <b>world</b> или <b>hello</b>? Поскольку <b>JavaScript</b> ставит выполнение кода на паузу, когда встречает ключевое слово <b>await</b>, мы не можем получить <b>hello</b> до разрешения промиса (обратите внимание, что <b>setTimeout()</b> всегда выполняется последней, поскольку является асинхронной (макро)задачей, поэтому <b>setTimeout(() =&gt; console.log(&quot;world&quot;), 0))</b> выполняется в самом конце). Здесь мы наблюдаем разницу в работе ключевого слова <b>await</b> перед асинхронным оператором (в данном случае мы использовали <b>setTimeout()</b> для примера) и вызовом функции/оператора без него."
    },
    {
        "id": 203,
        "question": "class MySort {\r\n  constructor(object) {\r\n    this.object = object\r\n  }\r\n\r\n  getSort() {\r\n    return Object.entries(this.object)[0][1].sort()[\r\n      Object.values(this.object).length\r\n    ]\r\n  }\r\n}\r\n\r\nconst object = {\r\n  month: [&quot;August&quot;, &quot;September&quot;, &quot;January&quot;, &quot;December&quot;],\r\n}\r\n\r\nconst sortMe = new MySort(object)\r\n\r\nconsole.log(sortMe.getSort())",
        "options": [
            "August",
            "September",
            "January",
            "December"
        ],
        "correct": 3,
        "explanation": "<b>Object.entries()</b> возвращает массив, состоящий из ключей и значений объекта в виде массивов (подмассивов), <b>Object.values()</b> - массив значений объекта, а <b>Object.keys()</b> - массив ключей. Таким образом, <b>Object.entries(object)</b> в рассматриваемом примере возвращает вложенный массив с одним элементом, значения которого вложены в другой массив -  <b>[[&quot;month&quot;, [&quot;August&quot;, &quot;September&quot;, &quot;January&quot;, &quot;December&quot;]]]</b>. По этой причине <b>Object.entries(this.object)[0][1].sort()</b> на самом деле сортирует значения массива и возвращает их в новом порядке: <b>August -&gt; December -&gt; January -&gt; September</b>. Следовательно, когда мы пытаемся получить элемент с индексом <b>[Object.values(this.object).length]</b>, то получаем <b>December</b>, поскольку <b>[Object.values(this.object).length]</b> возвращает <b>1</b> (длина массива, возвращенного <b>Object.values()</b>)."
    },
    {
        "id": 204,
        "question": "const flag = [] !== !!!!![]\r\n\r\nlet f = () =&gt; {}\r\n\r\nconsole.log((typeof f()).length + flag.toString().length)",
        "options": [
            "NaN",
            "12",
            "13",
            "14"
        ],
        "correct": 2,
        "explanation": "Сравнение двух массивов или объектов в <b>JavaScript</b> всегда возвращает <b>false</b>, поскольку объекты передаются по ссылке, в отличие от примитивов, таких как строка, число или логическое значение. Вот почему сравнение <b>[]</b> и <b>[]</b> с помощью <b>==</b> или <b>===</b> возвращает <b>false</b>. Сложная часть рассматриваемого примера - это <b>!==!!!!!</b>, что эквивалентно <b>!==</b>, так что на самом деле здесь нет ничего сложного. Таким образом, значением переменной <b>flag</b> является <b>true</b>. В функциональном выражении <b>f</b> мы используем стрелочную функцию, но <b>{}</b> - это часть функции, а не объект. Для того, чтобы вернуть объект, выражение следует переписать так: <b>let f = () =&gt; ({})</b> или использовать обычную функцию. С помощью ключевого слова <b>return</b> мы легко можем перехватить содержимое функции, когда используем обычный способ ее определения. Поэтому <b>typeof f()</b> возвращает <b>undefined</b>, а не <b>object</b>. Затем мы получаем <b>9</b> (длина <b>undefined</b>) + <b>4</b> (длина строки <b>true</b>), что равняется <b>13</b>."
    },
    {
        "id": 205,
        "question": "(function (a, b, c) {\r\n  arguments[2] = (typeof arguments).length\r\n  c &gt; 10 ? console.log(c) : console.log(++c)\r\n})(1, 2, 3)",
        "options": [
            "4",
            "5",
            "6",
            "7"
        ],
        "correct": 3,
        "explanation": "Здесь мы имеем дело с самовызываемой функцией (IIFE) с тремя параметрами. Обратите внимание, что <b>arguments</b> внутри функции возвращает массивоподобный объект, состоящий из аргументов, переданных функции при вызове. Когда мы присваиваем значение этому объекту (или любому его элементу), функция будет использовать это значение, а не значение переданного при ее вызове аргумента. Поэтому значением <b>(typeof arguments).length</b> будет <b>6</b>, а не <b>3</b>. <b>6</b> меньше <b>10</b>, поэтому мы получаем <b>console.log(++c)</b> или <b>7</b>. Обратите внимание, что <b>arguments</b> недоступна в стрелочных функциях. <b>ES6</b> рекомендует использовать rest-оператор (<b>...</b>) в качестве альтернативы <b>arguments</b> в стрелочных функциях, который возвращает настойщий массив. Таким массивом можно манипулировать с помощью методов <b>map</b>, <b>filter</b>, <b>reduce</b> и др."
    },
    {
        "id": 206,
        "question": "class Calculator {\r\n  constructor(a, b) {\r\n    this.a = a\r\n    this.b = b\r\n  }\r\n  static getFlag() {\r\n    return new Array(this.a).length == new Array(this.b)\r\n      .toString().length\r\n  }\r\n\r\n  getValue() {\r\n    return Calculator.getFlag() ? typeof this.a : typeof new Number(this.b)\r\n  }\r\n}\r\n\r\nconst me = new Calculator(5, 5)\r\n\r\nconsole.log(me.getValue())",
        "options": [
            "NaN",
            "string",
            "object",
            "number"
        ],
        "correct": 2,
        "explanation": "У нас имеется класс <b>Calculator</b>. При создании нового экземпляра, мы передаем ему два аргумента: <b>a</b> и <b>b</b>. Эти аргументы имеют одинаковые значения, но <b>new Array(this.a).length</b> сильно отличается от <b>new Array(this.b).toString().length</b>, поскольку последний возвращает длину строки <b>,,,,</b>, или <b>4</b>, а первый - длину массива, или <b>5</b>. По этой причине <b>getFlags()</b> возвращает <b>false</b>. В <b>getValue()</b> мы получаем выражение <b>typeof new Number(this.b)</b>, что возвращает <b>object</b>. Это немного отличается от выражения <b>typeof b</b>, которое возвращает <b>number</b>."
    },
    {
        "id": 207,
        "question": "var name = &quot;John&quot;\r\n\r\nconst obj = {\r\n  name: &quot;Jane&quot;,\r\n\r\n  callMe: function () {\r\n    return this.name\r\n  }\r\n}\r\n\r\nlet me = obj.callMe\r\n\r\nlet she = obj.callMe.bind(obj)\r\n\r\nlet result = me() === obj.callMe() ? she() : `${me()} ${she()}`\r\n\r\nconsole.log(result)",
        "options": [
            "undefined",
            "John",
            "Jane",
            "John Jane"
        ],
        "correct": 3,
        "explanation": "Данный вопрос посвящен ключевому слову <b>this</b>. У нас есть простой объект, содержащий один метод и одно свойство. Во-первых, важно понимать, что <b>let me = obj.callMe</b> и последующий вызов <b>me()</b> существенно отличаются от прямого вызова <b>obj.callMe()</b>. Если мы присваиваем переменной метод, объявленный внутри объекта, <b>this</b> в этом объекте будет вести себя по-разному (когда мы вызываем переменную как метод и когда мы вызываем сам метод). В частности, в первом случае, <b>this</b> - это глобальный объект (<b>window</b> в браузере, <b>global</b> в <b>Node.js</b>), в то время как во втором случае <b>this</b> внутри функции по-прежнему ссылается на свойство <b>name</b> объекта <b>obj</b>. Это означает, что <b>me()</b> возвращает <b>John</b>, а <b>obj.callMe</b> - <b>Jane</b>. Затем <b>result</b> возвращает <b>false</b>, и мы получаем <b>${me()} ${she()}</b>. Почему <b>she()</b> отличается от <b>me()</b>? Потому что <b>she()</b> привязана к объекту <b>obj</b>, а <b>me()</b> нет."
    },
    {
        "id": 208,
        "question": "((...a) =&gt; {\r\n  const b = [&quot;JavaScript&quot;, &quot;Russia&quot;]\r\n\r\n  const c = [...a, typeof a, ...b, &quot;apple&quot;]\r\n\r\n  console.log(c.length + c[0].length)\r\n})(new Array(10))",
        "options": [
            "5",
            "10",
            "15",
            "20"
        ],
        "correct": 2,
        "explanation": "<b>...</b> используется двумя способами: как оператор распространения (spread) и как прочие параметры (rest). В рассматриваемом примере мы видим оба способа. Первый оператор в самовызываемой функции (IIFE) - это, разумеется, rest, а в константе <b>c</b> мы видим spread. В первом случае мы можем передать функции любое количество аргументов. Обратите внимание, что <b>typeof a</b> - это <b>object</b>, несмотря на то, что фактически - это массив (в отличие от массивоподобного объекта <b>arguments</b>). spread позволяет объединять массивы. Таким образом, <b>...a</b> - это оператор rest при использовании в качестве параметра функции, но в константе - это оператор spread. Мы получаем массив <b>c</b> с пятью элементами (<b>...a</b> - это вложенный массив, поэтому его длина равняется <b>1</b>), но первый элемент данного массива сам имеет <b>10</b> элементов (<b>new Array(10)</b>). Сумма длин обоих массивов равняется <b>15</b>."
    },
    {
        "id": 209,
        "question": "function F(name, ...career) {\r\n  this.name = name\r\n\r\n  return Array.isArray(career) === true &amp;&amp; typeof career === &quot;object&quot; ? {} : &quot;&quot;\r\n}\r\n\r\nvar student = new F(&quot;John&quot;)\r\n\r\nconsole.log(student.name)",
        "options": [
            "John",
            "undefined",
            "ошибка",
            "false"
        ],
        "correct": 1,
        "explanation": "У нас имеется функция-конструктор <b>F</b> (название написано с заглавной буквы, это не обязательно, но таково соглашение), которая может использоваться для создания объекта, такого как объект <b>student</b> в рассматриваемом примере. В функции имеется два параметра, хотя второй параметр - это на самом деле rest-оператор (<b>...</b>). Его типом является <b>object</b>, но выражение <b>Array.isArray(career)</b> возвращает <b>true</b>. Оператор <b>return</b> возвращает пустой объект (<b>{}</b>). Вы можете быть немного удивлены, когда <b>console.log(student.name)</b> выведет в консоль <b>undefined</b>. Все дело в том, что у пустого объекта отсутствует свойство <b>name</b>."
    },
    {
        "id": 210,
        "question": "class Filter {\r\n  constructor(element) {\r\n    this.element = element\r\n  }\r\n  filter() {\r\n    return this.type() === &quot;object&quot; ? this.element[0].name : &quot;hello&quot;\r\n  }\r\n\r\n  type() {\r\n    return typeof this.element\r\n  }\r\n}\r\n\r\nlet countries = [\r\n  { name: &quot;Russia&quot;, isdeveloped: true },\r\n  { name: &quot;Vietnam&quot;, isdeveloped: false },\r\n]\r\n\r\nlet x = new Filter(countries)\r\n\r\nconst filter = countries.filter((item) =&gt; {\r\n  return !item.isDeveloped\r\n})\r\n\r\nconsole.log(x.filter().length + filter[0].name.length)",
        "options": [
            "11",
            "12",
            "13",
            "14"
        ],
        "correct": 2,
        "explanation": "Пример получился немного длинным. На самом деле, он не слишком сложный. Вы легко найдете правильный ответ, если потратите немного времени на размышления. Сначала мы определяем класс с двумя методами. Метод <b>filter</b> возвращает первый элемент массива (свойства <b>element</b>), или <b>hello</b>, в зависимости от метода <b>type</b>. Выражение <b>typeof array</b> возвращает <b>object</b>, так что <b>filter()</b> возвращает <b>this.elements[0].name</b>. Затем мы вызываем встроенный метод <b>filter</b>. Этот метод возвращает новый массив в зависимости от условия, переданного колбеку. Обратите внимание, что <b>!item.isDeveloped</b> означает <b>false</b>. Значит, мы получаем <b>Vietnam</b>. Наконец, мы получаем <b>Russia.length</b> и <b>Vietnam.length</b>, что в сумме дает <b>13</b>."
    },
    {
        "id": 211,
        "question": "async function abc() {\r\n  console.log(8)\r\n\r\n  await Promise.resolve(2).then(console.log)\r\n\r\n  console.log(3)\r\n}\r\n\r\nsetTimeout(() =&gt; {\r\n  console.log(1)\r\n}, 0)\r\n\r\nabc()\r\n\r\nqueueMicrotask(() =&gt; {\r\n  console.log(0)\r\n})\r\n\r\nPromise.resolve(4).then(console.log)\r\n\r\nconsole.log(6)",
        "options": [
            "6  8  3  0  4  2  1",
            "8  2  3  0  4  6  1",
            "6  8  2  0  4  3  1",
            "8  6  2  0  4  3  1"
        ],
        "correct": 3,
        "explanation": "Порядок выполнения асинхронного кода зависит от микро- и макрозадач. Микрозадачи имеют приоритет. Запомните, что синхронный код всегда выполняется перед асинхронным. Поэтому мы имеем следующий порядок:\r\n1. Синхронный код.\r\n2. Микрозадачи (промисы, <b>async/await</b>).\r\n3. Макрозадачи (<b>setTimeout</b>, <b>setInterval</b>).\r\nОбратите внимание, что в <b>Node.js</b> у нас также имеется <b>process.nextTick()</b>, который имеет наивысший приоритет, но в рассматриваемой задаче его нет.\r\nИтак, колбек <b>setTimeout()</b> будет выполнен последним, поскольку является макрозадачей. Поэтому мы получаем <b>1</b> последним.\r\nСледующей вызывается функция <b>abc</b>. Сначала в консоль выводится <b>8</b>. Затем на ключевом слове <b>await</b> выполнение функции приостанавливается, выполняется <b>console.log(6)</b>, поскольку <b>Promise.resolve(4).then(console.log)</b> - это асинхронный код. Вот почему следующим мы получаем <b>6</b>.\r\nТеперь настало время для <b>Promise.resolve(2)</b>, поэтому мы получаем <b>2</b>. Что произойдет, если убрать ключевое слово <b>await</b>?\r\nПоскольку у нас имеется ключевое слово <b>await</b>, выполнение кода как бы ставится на паузу. Мы получаем <b>0</b> и <b>4</b>, а не <b>3</b>. Промисы и <b>async/await</b> - микрозадачи, которые выполняются перед <b>console.log(3)</b>.\r\nНа следующем этапе мы получаем <b>3</b> и, последним, <b>1</b>.\r\nТак что же произойдет, если убрать ключевое слово <b>await</b>? Тогда порядок будет следующим: <b>8  3  6  2  0  4  1</b>."
    },
    {
        "id": 212,
        "question": "const username = {\r\n  x: &quot;youtube.com/username&quot;.length,\r\n  getMe() {\r\n    const inner = function () {\r\n      console.log(++this.x)\r\n    }\r\n    inner.bind(this)()\r\n  },\r\n}\r\n\r\nusername.getMe()",
        "options": [
            "20",
            "21",
            "22",
            "23"
        ],
        "correct": 1,
        "explanation": "Мы получаем <b>21</b>. Сначала <b>youtube.com/username</b> возвращает <b>20</b>, поскольку мы используем свойство <b>length</b> строки. Затем значение <b>x</b> увеличивается на <b>1</b> посредством <b>++this.x</b>. Вопрос выглядит тривиальным, но это не так. Нужно помнить о том, что <b>console.log(++this.x)</b> не будет работать, если значением <b>x</b> будет <b>undefined</b> при вызове за пределами объекта.\r\nМы можем решить эту проблему с <b>this</b> с помощью стрелочной функции: <b>const inner = () =&gt; {}</b>, поскольку стрелочные функции берут <b>this</b> из внешнего (лексического) окружения.\r\nВторым решением является использование трюка с <b>that/this</b>. Нам нужно лишь объявить новую переменную <b>const that = this</b> внутри <b>insideMe()</b> и перед объявлением функции <b>inner</b>. Это довольно распространенный прием.\r\nТретьим решением является использование <b>apply</b>, <b>call</b> или <b>bind</b>, нативных методов функций (функция - это объект). В данном случае, мы реализовали <b>bind(this)</b> для связывания функции и объекта, чтобы <b>this</b> указывал на объект при выполнении функции. Обратите внимание, что <b>bind()</b> не выполняется сразу, поэтому мы добавили <b>()</b> после него. Если заменить <b>bind()</b> на <b>call()</b>, то дополнительные круглые скобки не понадобятся. <b>inner.bind(this)()</b> станет <b>inner.call(this)</b>. На практике, мы, как правило, создаем переменную для хранения результата связывания функции и объекта."
    },
    {
        "id": 213,
        "question": "function* userName() {\r\n  yield &quot;js.pro.ru&quot;\r\n  yield &quot;youtube.com/username&quot;\r\n  yield &quot;John Smith&quot;\r\n}\r\n\r\nlet data = userName()\r\n\r\nconsole.log((typeof data).length + data.next().value.length)",
        "options": [
            "NaN",
            "10",
            "ошибка",
            "15"
        ],
        "correct": 3,
        "explanation": "Присмотритесь к функции. После ключевого слова <b>function</b> имеется символ <b>*</b>. В функции отсутствует ключевое слово <b>return</b>. Что здесь происходит?\r\nЕсли вы знакомы с генераторами, вам не составит труда решить рассматриваемую задачу. Мы не часто используем генераторы, но они являются основой <b>async/await</b>, позволяющей удобно работать с асинхронным кодом.\r\nВыражение <b>typeof data</b> возвращает <b>object</b>, а не <b>function</b>. <b>typeof userName</b> возвращает <b>function</b>, поскольку <b>userName</b> - обычная функция. Выражение <b>(typeof data).length</b> возвращает <b>6</b>.\r\n<b>data.next()</b> вызывает встроенный метод <b>next</b>, который возвращает значение первого <b>yield</b>, определенного в функции. Получаем <b>9</b> - длину строки <b>js.pro.ru</b>.\r\nВ итоге получаем <b>15</b>. Понимание работы генераторов имеет важное значение для понимания работы ключевых слов <b>async/await</b>."
    },
    {
        "id": 214,
        "question": "const a = [1, 2, &quot;one&quot;, 3, 1, &quot;one&quot;, &quot;two&quot;, 3]\r\n\r\nconst b = [...new Set(a)]\r\n\r\nb.length = &quot;one&quot;.length\r\n\r\nconsole.log(b)",
        "options": [
            "4",
            "[1, 2, &quot;one&quot;, 3, &quot;two&quot;]",
            "[1, 2, &quot;one&quot;, &quot;two&quot;]",
            "[1, 2, &quot;one&quot;]"
        ],
        "correct": 3,
        "explanation": "<b>...</b> в массиве - это spread-оператор (оператор распространения/распаковки), который похож на rest-оператор (прочие параметры). Данный оператор позволяет объединять (изменять) и копировать массивы. В рассматриваемом примере <b>b</b> - это копия <b>a</b>. Тем не менее, когда мы передаем <b>a</b> в <b>Set</b>, возвращаются только уникальные значения. Это означает, что <b>b</b> содержит <b>[1, 2, &quot;one&quot;, 3, &quot;two&quot;]</b>. Затем мы устанавливаем значение длины <b>b</b> равным <b>3</b> (<b>&quot;one&quot;.length</b>). Таким образом, мы уменьшили длину массива. Вот почему в консоль выводится только <b>[1, 2, &quot;one&quot;]</b>."
    },
    {
        "id": 215,
        "question": "const one = function (p) {\r\n  return arguments[0]\r\n}\r\n\r\nconst two = function (...p) {\r\n  return arguments[arguments[0]]\r\n}\r\n\r\nconst a = [one(123), two(1, 2, 3)]\r\n\r\nconsole.log(typeof a !== &quot;object&quot; ? a[0] : a[1])",
        "options": [
            "1",
            "2",
            "3",
            "123"
        ],
        "correct": 1,
        "explanation": "Прежде всего, следует отметить, что мы не можем использовать <b>arguments</b> в стрелочных функциях. <b>arguments</b> - это массивоподобный объект, который содержит аргументы, переданные функции при ее вызове.\r\nОбратите внимание, что <b>...</b> в массиве - это spread-оператор (оператор распространения/распаковки), который ведет себя иначе, чем rest-оператор (прочие параметры). При использовании <b>...</b> в функции, мы можем передавать ей любое количество аргументов.\r\nТакже обратите внимание, что в функции <b>two</b> мы возвращаем <b>arguments[arguments[0]]</b> или <b>2</b>, а не <b>1</b>, поскольку <b>arguments[0]</b> возвращает <b>1</b>, а <b>arguments[1]</b> - <b>2</b>.\r\nВыражение <b>typeof a</b> возвращает <b>object</b>. В итоге мы получаем <b>2</b> из <b>a[1]</b> или <b>two(1, 2, 3)</b>."
    },
    {
        "id": 216,
        "question": "class Component {\r\n  constructor(age) {\r\n    this.age = age + `${typeof Coder}`.length\r\n  }\r\n\r\n  getAge() {\r\n    return ++this.age\r\n  }\r\n}\r\n\r\nclass Coder extends Component {\r\n  constructor(age) {\r\n    super(age)\r\n    this.age = age - `${typeof Coder}`.length\r\n  }\r\n}\r\n\r\nconst a = new Coder(16)\r\n\r\nconsole.log(a.getAge())",
        "options": [
            "7",
            "8",
            "9",
            "10"
        ],
        "correct": 2,
        "explanation": "У нас есть два простых класса, <b>Coder</b> расширяет <b>Component</b>. Ничего особенного. Поскольку <b>typeof ClassName</b> возвращает <b>function</b>, а не <b>class</b>, мы получаем <b>8</b> из <b>&#39;function&#39;.length</b>.\r\nПоскольку мы используем <b>super(age)</b> в классе <b>Coder</b>, то перезаписываем конструктор родительского класса <b>Component</b>. Поэтому при инициализации объекта <b>a</b> автоматически выполняется &quot;this.age = age - <b>${typeof Coder}</b>.length&quot;. Разница между дочерним и родительским конструкторами заключается в арифметической операции.\r\nТаким образом, мы получаем <b>16 - 8</b>, а не <b>16 + 8</b>, т.е. <b>8</b>. Функция <b>getAge</b> возвращает <b>9</b>.\r\nПомните, что <b>JavaScript</b> - это не настоящий объектно-ориентированный язык программирования, несмотря на то, что мы можем использовать в нем классы и объекты."
    },
    {
        "id": 217,
        "question": "class RemoveFalse {\r\n  constructor(element) {\r\n    this.element = element\r\n\r\n    this.length = this.removeFalse().length\r\n  }\r\n\r\n  removeFalse() {\r\n    this.element = this.element.filter(Boolean)\r\n\r\n    return this.element\r\n  }\r\n}\r\n\r\nconst theArray = [true, false, 1, 0, NaN, undefined, &quot;&quot;, null, &quot;string&quot;]\r\n\r\nconst a = new RemoveFalse(theArray)\r\n\r\nconsole.log(a.length)",
        "options": [
            "false",
            "true",
            "2",
            "3"
        ],
        "correct": 3,
        "explanation": "Основной вывод, который можно сделать из приведенного примера - <b>filter(Boolean)</b> может быть использован для удаления из массива ложных значений. Для этого мы также можем использовать <b>filter(callback)</b>. Обратите внимание, что мы должны передать методу <b>filter</b> функцию обратного вызова, а <b>Boolean</b> как раз является такой функцией. Вы можете убедиться в этом с помощью <b>typeof Boolean</b>.\r\nКак и <b>map</b> или <b>reduce</b>, <b>filter</b> возвращает новый массив на основе существующего. <b>[true, false, 1, 0, NaN, undefined, &#39;&#39;, null, &#39;string&#39;].filter(Boolean)</b> возвращает <b>[true, 1, &#39;string&#39;]</b>, поэтому <b>a.length</b> возвращает <b>3</b>."
    },
    {
        "id": 218,
        "question": "const coderfarm = [1, [], {}, [], 2, 3]\r\n\r\nconst converted = Number(coderfarm instanceof Array)\r\n\r\nconst result = coderfarm.indexOf(converted + true)\r\n\r\nconsole.log(result)",
        "options": [
            "[]",
            "{}",
            "2",
            "4"
        ],
        "correct": 3,
        "explanation": "У нас имеется массив, состоящий из нескольких чисел, двух массивов и объекта. Посредством встроенной функции <b>Number</b> мы можем конвертировать (преобразовать) любое переданное функции значение в число. <b>codefarm instanceof Array</b> возвращает <b>true</b>, которое преобразуется в <b>1</b>. Для проверки того, является ли значение массивом, также можно использовать <b>Array.isArray(arrayToBeChecked)</b>, возвращающий логическое значение. Выражение <b>typeof []</b> возвращает <b>object</b>, а не <b>array</b>. Встроенная функция <b>indexOf</b> возвращает индекс искомого элемента. Поскольку <b>converted + true</b> возвращает <b>2</b>, мы ищем индекс элемента <b>2</b> в массиве <b>codefarm</b>. Данный элемент находится на <b>4</b> позиции."
    },
    {
        "id": 219,
        "question": "const converter = (arrayInput) =&gt; {\r\n  return { ...arrayInput }\r\n}\r\n\r\nconst content = [&quot;function&quot;, &quot;object&quot;, &quot;decorator&quot;]\r\n\r\nconst checking = content[Number(false)]\r\n\r\nconst result = typeof converter(content) === content[1]\r\n\r\nconsole.log(checking ? (result ? (typeof converter).length : false) : false)",
        "options": [
            "6",
            "NaN",
            "true",
            "8"
        ],
        "correct": 3,
        "explanation": "Оператор <b>...</b> является очень полезным. В функции <b>converted</b> нет ничего необычного, она использует преимущества <b>...</b> (оператор rest || оператор spread) для преобразования массива в объект.\r\nКонстанта <b>checking</b> имеет значение <b>function</b> из <b>Number(false)</b>, что дает <b>0</b>, т.е. значением <b>checking</b> является элемент массива <b>content</b> с индексом <b>0</b>.\r\nКонстанта <b>result</b> имеет значение <b>true</b>, поскольку <b>typeof converter(content)</b> возвращает <b>object</b>, как и <b>content[1]</b>.\r\nТаким образом, мы имеем <b>checking = true</b> и <b>result = true</b>, поэтому получаем <b>(typeof converter).length</b> или <b>&#39;function&#39;.length</b>, или <b>8</b>.\r\nГлавный вывод здесь такой: мы можем использовать оператор распространения (spread-оператор) для преобразования массива в объект. Например: <b>const a = [&#39;hello&#39;, 2]; const b = { ...a }</b>, получаем <b>b = { 0: &#39;hello&#39;, 1: 2 }</b>. Ключами объекта в данном случае являются индексы элементов в массиве."
    },
    {
        "id": 220,
        "question": "function* js(length) {\r\n  for (let i = length.length; i &gt; 0; --i) {\r\n    yield i\r\n  }\r\n}\r\n\r\nlet getJS = js(typeof js)\r\n\r\nlet result = getJS.next().value\r\n\r\nconsole.log(result + getJS.next().value)",
        "options": [
            "10",
            "14",
            "15",
            "16"
        ],
        "correct": 2,
        "explanation": "Здесь мы имеем дело с функцией-генератором, которая определяется с помощью специального символа <b>*</b> после названия. Благодаря ключевому слову <b>yield</b> мы можем хранить в функции любое количество значений. Поскольку <b>typeof js</b> возвращает <b>function</b>, длина этой строки равняется <b>8</b>. Поэтому при вызове <b>getJS.next().value</b> мы получаем <b>8</b>. При следующем вызове мы получаем <b>7</b>, затем <b>6</b>. Генератор может хранить и возвращать любое количество значений. В итоге мы получаем <b>8 + 7</b>, или <b>15</b>."
    },
    {
        "id": 221,
        "question": "var ages = [10, 15, 20, 25]\r\n\r\nlet response = []\r\n\r\nages.some(function (currentValue, index, ages) {\r\n  if (currentValue &gt; ages[ages.length - index])\r\n    response.push(currentValue + ages.length)\r\n})\r\n\r\nconsole.log(response)",
        "options": [
            "[20]",
            "[20, 25]",
            "[25, 29]",
            "[29]"
        ],
        "correct": 3,
        "explanation": "<b>Array.prototype.some()</b> - это встроенная функция, позволяющая обрабатывать элементы массива с помощью колбека. Колбек в рассматриваемом примере имеет три параметра: <b>currentValue</b> (значение текущего элемента массива), <b>index</b> (индекс текущего элемента) и <b>ages</b> (сам массив).\r\nМетод <b>some</b> возвращает логическое значение. Выражение <b>currentValue &gt; ages[ages.length - index]</b> возвращает <b>true</b> лишь один раз, поскольку речь идет о последнем элементе. Давайте рассмотрим код последовательно:\r\n1. <b>10 &gt; ages[4 - 0]</b>: поскольку <b>ages[4]</b> возвращает <b>undefined</b>, и <b>10 &gt; undefined</b> возвращает <b>false</b>, выполнение кода останавливается.\r\n2. <b>15 &gt; ages[4 - 1]</b>: поскольку <b>ages[3]</b> возвращает <b>25</b>, условие является ложным.\r\n3. <b>20 &gt; ages[4 - 2]</b>: поскольку <b>ages[2]</b> возвращает <b>20</b>, условие также не удовлетворяется.\r\n4. <b>25 &gt; ages[4 - 3]</b>: поскольку <b>ages[1]</b> возвращает <b>10</b>, выражение возвращает <b>true</b>. Только это значение помещается в массив <b>response</b>.\r\nВ массиве <b>response</b> содержится <b>response.push(currentValue + ages.length)</b> или <b>25 + ages.length</b>, или <b>25 + 4</b>, т.е. <b>29</b>."
    },
    {
        "id": 222,
        "question": "const getString = (string, method = false) =&gt; {\r\n  if (method === true) {\r\n    return string.slice(1, 4).length\r\n  }\r\n\r\n  return string.substr(1, 4).length\r\n}\r\n\r\nconsole.log(getString(&quot;hello&quot;, true) + getString(&quot;hello&quot;))",
        "options": [
            "6",
            "7",
            "8",
            "9"
        ],
        "correct": 1,
        "explanation": "<b>getString</b> - это стрелочная функция с двумя параметрами. Как видите, параметр <b>method</b> имеет значение по умолчанию, равное <b>false</b>. Если не передать другое значение при вызове функции или передать <b>undefined</b>, будет использовано значение по умолчанию.\r\nОсновной вывод: разница между <b>slice(1, 4)</b>, возвращающим <b>3</b>, и <b>substr(1, 4)</b>, возвращающим <b>4</b>.\r\n<b>console.log(getString(&#39;hello&#39;, true) + getString(&#39;hello&#39;))</b> или <b>console.log(string.substr(1, 4).length + string.slice(1, 4).length)</b>, или <b>console.log(4 + 3)</b> выводит в консоль <b>7</b>."
    },
    {
        "id": 223,
        "question": "class UserName {\r\n  name = &quot;hello world&quot;\r\n\r\n  getSlice(slice) {\r\n    return this.getName(slice).slice(true, this.name.length)\r\n  }\r\n\r\n  getName(space) {\r\n    return this.name.split(space)\r\n  }\r\n}\r\n\r\nUserName.prototype.split = function (argument) {\r\n  return this.getSlice(argument)\r\n}\r\n\r\nconst a = new UserName()\r\n\r\nconsole.log(a.split(&quot;&quot;).length)",
        "options": [
            "NaN",
            "true",
            "10",
            "11"
        ],
        "correct": 2,
        "explanation": "В рассматриваемом примере нет ничего необычного. Он намеренно запутан. У нас есть класс <b>UserName</b> с двумя методами и одним свойством. Мы добавляем к нему еще один метод - <b>split</b>, используя традиционный способ (через <b>prototype</b>). Помните, что <b>class</b> в <b>JavaScript</b> - это лишь синтаксический сахар для функции-конструктора (выражение <b>typeof ClassName</b> возвращает <b>function</b>).\r\nПри вызове <b>split()</b>, мы передаем ему пустую строку. Данный метод вызывает другие методы. Порядок следующий:\r\n<b>split(&quot;&quot;) -&gt; this.getSlice(&quot;&quot;) -&gt; this.getName(&quot;&quot;) -&gt; this.name.split(&quot;&quot;)</b>. Здесь <b>split</b> - это функция, преобразующая строку в массив.\r\nОбратите внимание, что в <b>getSlice()</b> мы используем <b>slice(true, this.name.length)</b> для модификации массива с <b>1</b> по <b>11</b> индексы. Длина нового массива составляет <b>10</b>.\r\nЭтот код помогает понять, как работают прототипы в <b>JavaScript</b>, а также увидеть разницу между встроенными и пользовательскими методами."
    },
    {
        "id": 224,
        "question": "function javaScript(node) {\r\n  let one = node.includes(&quot;I&quot;) ? &quot; love &quot; : &quot; you &quot;\r\n\r\n  return function (deno = one) {\r\n    let two = node.replace(deno, &quot; done &quot;)\r\n\r\n    return function (done = two) {\r\n      return (node + deno + done).length\r\n    }\r\n  }\r\n}\r\n\r\nconsole.log(javaScript(&quot;I love you&quot;)()())",
        "options": [
            "20",
            "26",
            "23",
            "25"
        ],
        "correct": 1,
        "explanation": "Кроме изучения некоторых встроенных функций для работы со строками, таких как <b>replace</b> и <b>includes</b>, здесь мы имеем дело с каррированием (currying). Обратите внимание, что только внешняя (основная) функция имеет название, внутренние функции являются анонимными. У нас также имеется три оператора <b>return</b>.\r\nПри вызове функции необходимо использовать 3 пары круглых скобок - <b>javaScript(&#39;I love you&#39;)()()</b>. Мы не передаем аргументы вложенным функциям, поэтому они используют значения по умолчанию.\r\nРезультирующим выражением является <b>return (node + deno + done).length</b>, где <b>node</b> - <b>I love you</b>, <b>deno</b> - <b> love </b> (2 пробела) и <b>done</b> - <b>I done you</b>. Длина получившейся строки <b>I love you love I done you</b> равняется <b>26</b>. Пробелы принимаются в расчет."
    },
    {
        "id": 225,
        "question": "(function (flag) {\r\n  let age = Boolean(NaN === NaN ? false : flag)\r\n\r\n  console.log(age.toString()[Number(flag)])\r\n})([])",
        "options": [
            "&quot;f&quot;",
            "&quot;t&quot;",
            "true",
            "false"
        ],
        "correct": 1,
        "explanation": "У нас имеется самовызывающаяся функция (IIFE) с пустым массивом в качестве аргумента. Обратите внимание, что сравнение <b>NaN === NaN</b> возвращает <b>false</b>, поэтому переменная <b>age</b> получает значение <b>flag</b>, т.е. пустой массив.\r\n<b>Boolean([])</b> возвращает <b>true</b>.\r\nФункция <b>toString</b> возвращает строку <b>true</b>, а <b>Number([])</b> - <b>0</b>. Поэтому в консоль выводится <b>t</b>.\r\nОбратите внимание, что <b>Boolean([]) === true</b>, но <b>Number([]) === 0</b>, а <b>NaN === NaN</b> возвращает <b>false</b>."
    },
    {
        "id": 226,
        "question": "console.log(Boolean([]))\r\nconsole.log(Number([]))\r\nconsole.log(Number(Boolean([])))\r\nconsole.log(Boolean(Number([])))\r\n\r\nconsole.log(Boolean({}))\r\nconsole.log(Number({}))\r\nconsole.log(Number(Boolean({})))\r\nconsole.log(Boolean(Number({})))\r\n\r\nconsole.log(Boolean(new Boolean(false)))",
        "options": [
            "true  0  1  false  true  1  1  false  false",
            "true  0  1  false  false  NaN  1  false  true",
            "true  0  1  false  false  false  1  false  false",
            "true  0  1  false  true  NaN  1  false  true"
        ],
        "correct": 3,
        "explanation": "<b>JavaScript</b> - это язык со слабой и динамической типизацией. Тип переменной в <b>JS</b> может меняться в зависимости от ее значения. При изменении одного значения на другое поведение <b>JS</b> может быть весьма неожиданным.\r\nНапример, <b>Number([])</b> возвращает <b>0</b>, <b>Number({})</b> - <b>NaN</b>, а <b>Boolean([])</b> и <b>Boolean({})</b> - <b>true</b>.\r\n<b>Boolean(new Boolean(false))</b> возвращает <b>true</b>, несмотря на то, что мы передаем функции-конструктору <b>Boolean</b> значение <b>false</b>. Однако, если мы уберем ключевое слово <b>new</b>, то получим <b>false</b>. <b>Boolean(new Boolean(false))</b> - это валидная с точки зрения <b>JS</b> операция, поэтому возвращается <b>true</b>. С другой стороны, <b>Boolean(Boolean(false))</b> без ключевого слова <b>new</b>, возвращает <b>false</b>, поскольку значение <b>false</b> вообще не является операцией."
    },
    {
        "id": 227,
        "question": "const myYoutube = {\r\n  name: &quot;username&quot;,\r\n  address: &quot;youtube.com/username&quot;,\r\n  getInfo() {\r\n    return this\r\n  },\r\n  content: () =&gt; (this === window ? myYoutube.getInfo() : this),\r\n}\r\n\r\nconsole.log(myYoutube.content().name)",
        "options": [
            "username",
            "window",
            "NaN",
            "undefined"
        ],
        "correct": 0,
        "explanation": "Для того, чтобы правильно ответить на данный вопрос, нужно понимать концепцию <b>this</b> в <b>JavaScript</b> (в расматриваемом примере речь идет только о браузере). По умолчанию <b>this</b> указывает на глобальный объект <b>window</b>. Обратите внимание, что <b>Window</b> (с заглавной буквы) - это функция-конструктор объекта <b>window</b>. Поэтому <b>console.log(this === window)</b> возвращает <b>true</b>, а <b>console.log(this === Window)</b> - <b>false</b>.\r\n<b>getInfo</b> - это стрелочная функция, <b>this</b>, объявленный внутри этой функции, указывает на <b>window</b>, поэтому <b>myYoutube.content()</b> возвращает <b>myYoutube.getInfo()</b>. Обратите внимание, что нам пришлось явно писать <b>myYoutube.getInfo()</b> для того, чтобы код работал корректно, поскольку <b>this</b> не указывает на текущий объект. В функции <b>getInfo</b> <b>this</b> указывает на текущий объект, поскольку <b>getInfo</b> - это обычная функция.\r\nВ итоге мы получаем <b>username</b> как значение свойства <b>name</b>."
    },
    {
        "id": 228,
        "question": "const myArray = [1, 2, 3]\r\n\r\nmyArray.someProperty = this\r\n\r\nArray.prototype.someOtherProperty = &quot;hello&quot;\r\n\r\nlet result = []\r\n\r\nfor (let key in myArray) {\r\n  result.push(key)\r\n}\r\n\r\nfor (let key in myArray) {\r\n  if (myArray.hasOwnProperty(key)) {\r\n    result.push(key)\r\n  }\r\n}\r\n\r\nconsole.log(result.length)",
        "options": [
            "10",
            "NaN",
            "9",
            "7"
        ],
        "correct": 2,
        "explanation": "У нас имеется простой массив с тремя элементами. При проверке типа массива с помощью оператора <b>typeof</b> мы получаем <b>object</b> (для определения того, что значение является массивом, можно использовать <b>Array.isArray(array)</b> или <b>array instanceof Array</b>).\r\nПри объявлении <b>myArray.someProperty</b> мы добавляем новое свойство к данному массиву. При объявлении <b>Array.prototype.someProperty = &#39;hello&#39;</b>, мы добавляем новое свойство ко всем массивам.\r\nЦикл <b>for-in</b> перебирает массив и возвращает пары ключ/значение, включая унаследованные свойства. На второй итерации мы используем метод <b>hasOwnProperty</b>, который перебирает только собственные (не унаследованные) ключи/значения.\r\nЕсли коротко, на первой итерации мы получаем <b>5</b> (<b>3</b> исходных элемента, <b>1</b> собственное свойство и еще <b>1</b> унаследованное свойство). На второй - только <b>4</b> (унаследованное свойство не учитывается).\r\nДля перебора массива обычно используется цикл <b>for-of</b> или классический цикл <b>for</b>. Использование <b>for-in</b> для этого считается плохой практикой. <b>for-in</b> обычно используется для перебора объектов."
    },
    {
        "id": 229,
        "question": "const coderfarm = [1, 2, 3, 4, 5]\r\n\r\nconst [top, ...bottom] = (function (a) {\r\n  let result = a\r\n\r\n  a.unshift(new Array(3))\r\n\r\n  return result\r\n})(coderfarm)\r\n\r\nconsole.log(top.length + bottom.length)",
        "options": [
            "8",
            "9",
            "10",
            "11"
        ],
        "correct": 0,
        "explanation": "Здесь мы используем деструктуризацию для извлечения значений массива (или объекта) и spread-оператор (оператор распространения/распаковки).\r\nДеструктурируемый массив возвращается из самовызывающейся функции (IIFE). Сначала мы передаем аргумент <b>codefarm</b> (параметр <b>a</b> функции). Затем мы обновляем этот массив, добавляя в начало (посредством метода <b>unshift</b>) массив из трех <b>undefined</b> (с помощью <b>new Array(3)</b>). После этого массив выглядит так: <b>[[undefined, undefined, undefined], 1, 2, 3, 4, 5]</b>.\r\nПеременная <b>top</b> - это первый элемент массива или <b>[undefined, undefined, undefined]</b>, длина которого равняется <b>3</b>.\r\nПеременная <b>bottom</b> - это прочие элементы массива, ее длина равняется <b>5</b>.\r\nВ итоге мы получаем <b>3 + 5</b> или <b>8</b>."
    },
    {
        "id": 230,
        "question": "let age = { number: 10 }\r\n\r\nconst getAge = (flag) =&gt; {\r\n  flag ? delete age.number : delete age\r\n  return age.number++\r\n}\r\n\r\nconsole.log(getAge(false))\r\n\r\nconsole.log(age.number)\r\n\r\nconsole.log(getAge(true))\r\n\r\nconsole.log(age.number)",
        "options": [
            "10  10  NaN  NaN",
            "10  10  undefined  undefined",
            "10  11  undefined  undefined",
            "10  11  NaN  NaN"
        ],
        "correct": 3,
        "explanation": "Оператор <b>delete</b> удаляет свойство объекта, но не сам объект. У нас есть простая функция <b>getAge</b> с параметром <b>flag</b>. Если значением <b>flag</b> является <b>true</b>, выполняется код <b>delete age.number</b>, в противном случае, мы пытаемся удалить объект.\r\nПоскольку <b>delete</b> не может удалить объект, можно сказать, что <b>delete age</b> ничего не делает. Выражение <b>console.log(getAge(false))</b> возвращает <b>10</b> и затем увеличивает значение <b>age.number</b> на <b>1</b>. Данное значение хранится в памяти, поэтому <b>console.log(age.number)</b> возвращает <b>11</b>.\r\nКогда мы присваиваем <b>flag</b> значение <b>true</b>, <b>console.log(getAge(true))</b> выполняет код <b>delete age.number</b>, что удаляет свойство <b>number</b> объекта <b>age</b>. Это означает, что <b>age.number</b> равняется <b>undefined</b>. Однако, поскольку мы пытаемся увеличить значение этого свойства на <b>1</b> с помощью оператора <b>++</b>, возвращается <b>NaN</b>."
    },
    {
        "id": 231,
        "question": "const f = function() {\r\n  this.x = 5;\r\n  (function() {\r\n      this.x = 3;\r\n  })();\r\n  console.log(this.x);\r\n};\r\n\r\nconst obj = {\r\n  x: 4,\r\n  m: function() {\r\n    console.log(this.x);\r\n  },\r\n};\r\n\r\nf();\r\nnew f();\r\nobj.m();\r\nnew obj.m();\r\nf.call(f);\r\nobj.m.call(f);",
        "options": [
            "3 5 4 undefined 5 5",
            "5 5 4 undefined 5 undefined",
            "3 3 undefined 4 undefined 4",
            "5 5 4 undefined 3 5"
        ],
        "correct": 0,
        "explanation": "При вызове функции <b>f</b> ее контекст (значение <b>this</b>) равняется <b>window</b> (в рассматриваемом примере речь идет только о браузере). Контекст самовызывающейся функции (IIFE) также равняется <b>window</b>, поэтому значением <b>window.x</b> становится <b>3</b>. Когда функцию вызывают с ключевым словом <b>new</b> - создается новый объект, который становится контекстом функции (конструктора), но самовызывающаяся функция этот контекст не получает, поэтому второй раз в консоль выводится <b>5</b>. Далее мы имеем дело с методом <b>m</b> объекта <b>obj</b>. Контекстом метода является объект, которому данный метод принадлежит. Значением свойства <b>obj.x</b> является <b>4</b>, что и выводится в консоль.\r\nОднако, если вызвать тот же метод с помощью <b>new</b>, то для <b>m</b> будет создан новый контекст, в этом новом контексте <b>x</b> будет иметь значение <b>undefined</b>. Вызывая функцию <b>f</b> с помощью <b>call(f)</b>, мы определяем, что контекст данной функции равен самой функции, т.е. <b>this === f</b>. Функция - это специальный вид объекта, которому, как и любому другому объекту, можно добавлять свойства. <b>f.x</b> равняется <b>5</b>, что и выводится в консоль. Наконец, мы вызываем метод <b>m</b> с помощью <b>call(f)</b>, т.е. <b>this === f</b>. После предыдущего вызова свойство <b>f.x</b> равняется <b>5</b>, поэтому вместо <b>undefined</b> в консоль снова выводится <b>5</b>."
    }
];

class Quiz {
    id;
    question;
    options;
    correct;
    explanation;
    _isCorrect = false;
    constructor() {
        if (listQuiz.length === 0) {
            this.id = 0;
            this.question = 'Стандартный вопрос отсутствует';
            this.options = ['Опция 1', 'Опция 2', 'Опция 3', 'Опция 4'];
            this.correct = 0;
            this.explanation = 'Пояснение отсутствует';
            return;
        }
        const randomQuestion = this.getRandomQuestion();
        if (!randomQuestion.options || randomQuestion.options.length < 4) {
            throw new Error('Недостаточно вариантов ответа для выбранного вопроса.');
        }
        this.id = randomQuestion.id;
        this.question = randomQuestion.question;
        this.options = randomQuestion.options;
        this.correct = randomQuestion.correct;
        this.explanation = randomQuestion.explanation;
    }
    ;
    getRandomQuestion() {
        const randomIndex = Math.floor(Math.random() * listQuiz.length);
        return listQuiz[randomIndex];
    }
    ;
    set isCorrect(value) {
        this._isCorrect = value;
    }
    ;
    getQuestionAndOptionsHTML() {
        return `<u>id: ${this.id}</u>  <b>Что будет выведено в консоль?</b>\n
<pre>${this.question}</pre>\n\n<b>Варианты ответа:</b>
Вариант 1: ${this.options[0]}
Вариант 2: ${this.options[1]}
Вариант 3: ${this.options[2]}
Вариант 4: ${this.options[3]}`;
    }
    ;
    getIsCorrectAndExplanationHTML() {
        return `<u>id: ${this.id}</u>  ${this._isCorrect ? '<b>✅ Вы ответили правильно!</b>' : `<b>🤮 Вы ответили не правильно!
\nПравильный ответ:</b> ${this.options[this.correct]}`}
\n<b>Пояснение:</b>
<tg-spoiler>${this.explanation}</tg-spoiler>`;
    }
    ;
}

async function startGame(ctx) {
    ctx.session.quiz = new Quiz();
    await ctx.reply(ctx.session.quiz.getQuestionAndOptionsHTML(), {
        parse_mode: 'HTML',
        reply_markup: keyboardOptions
    });
}

function initial() {
    return { quiz: new Quiz() };
}

config();
const bot = new Bot(process.env.BOT_TOKEN);
bot.api.setMyCommands(commands);
bot.use(session({ initial }));
bot.hears(/.*вопрос$/i, startGame);
bot.hears(/^Вариант (\d)$/i, handleAnswerButtonClick);
bot.command('help', handleHelpCommand);
bot.command('start', handleStartCommand);
bot.command('question', startGame);
bot.command('progress', handleProgressCommand);
bot.on('message', async (ctx) => {
    await ctx.reply(descriptionBadMessage);
});
bot.catch(handleBotError);
bot.start();

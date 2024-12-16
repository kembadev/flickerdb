# 💾FlickerDB

Create posts db and add the first post:

```js
import FlickerDB from 'flickerdb';

const postsDB = new FlickerDB('db/posts');

postsDB.addOne({ title: 'post 1', content: 'this is my first post' })
```

## Description

Local JSON database based on the file system. Designed for maximum memory efficiency, it features robust error handling, and a variety and easy-to-use methods for seamless integration 🚀

## Requirements

### Node.js

[Node.js](https://nodejs.org/en/) version 16 or newer.

## ⚡Features

- Type-safe (made in [Typescript](https://www.typescriptlang.org/)).
- Atomic write.
- Memmory-friendly.
- Robust error handling 💪

## Installation

```bash
npm install flickerdb
```

## Usage

Create posts db and add the first post:

```ts
import FlickerDB from 'flickerdb';

type Post = { title: string; content: string }

const postsDB = new FlickerDB<Post>('db/posts');

postsDB.addOne({ title: 'post 1', content: 'this is my first post' })
  .then(id => console.log("post's id:", id))
  .catch(err => console.error('could not add the post. error code:', err.code));
```

In db/posts.json:

```json
{"d98821f5-87a6-47c8-bb46-8af04a65c7ba":{"title":"post 1","content":"this is my first post"}}
```

Get 10 posts where the title property contains the substring 'funko pop'

```js
postsDB
  .find(entry => entry.data.title.includes('funko pop'), { limit: 10 })
  .then(result => {
    if(!result) return console.log('no matches found')

    console.log('posts found:', result.entries)
  })
  .catch(() => console.log('something went wrong'));
```

More examples [here](https://github.com/kembadev/flickerdb/tree/master/src/examples).

> [!WARNING]
> Manipulating the database file manually could arise unexpected behaviors and frequent thrown exceptions. Avoid doing it in favor to keep things working 😎

## API

### 💾FlickerDB

Initializes db. Usage: `new FlickerDB(PathLike, FlickerOptions)`.

- `PathLike`: string, URL or Buffer.
- `FlickerOptions`:
  - `overwrite`: Whether overwrite the previous content when init db or not. `Default: true`.
  - `stringify`: The desired serialization method to use. `Default: JSON.stringify`.

```js
import FlickerDB from 'flickerdb'

const db = new FlickerDB('db', { overwrite: false });
```

#### Instance methods:

- `add`: add new entries to db.

```js
const ids = await db.add(["data1", "data2"]);

console.log(ids.length); // output: 2
```

- `addOne`: add new entry to db.

```js
const id = await db.addOne("data1");

console.log('entry id:', id);
```

> [!NOTE]
> You should use add over addOne in those cases where you want to add more than one entry at a time. addOne uses add under the hood so using it several times instead of using add is slower.

- `find`: Get an object that contains a list of entries and other properties. Usage: `db.find(matcherFn, FilterOptions)`.

  - `matcherFn`: A function that takes each entry as argument. A return value of true indicates that the entry meet the match.
  - `FilterOptions`:
    - `limit`: Limits the number of entries to search. `Default: Infinity`.
    - `offset`: Indicates from where to start saving the entries. For example,
  if the offset is set to 3, the first 3 entries matched are ignore.
  Values less than 0 are interpreted as 0. `Default: 0`.
    - `holdTillMatch`: Once the limit has been reached, the search is intended to stop.
  If `holdTillMatch` is true, the search stops just after one more match
  is found (which is not added to final entries), preventing from stop
  when limit is reached. This is useful in scenarios where you wanna know
  whether there are more matches in addition to offset + limit.
  For example, if you apply pagination maybe you wanna know whether
  some entry left or not. `Default: false`.

```js
// get 10 entries which data content includes the word "empanadas" or "empanada" in it
const result = await db.find(
  ({ data }) => /empanadas?/gi.test(data),
  { limit: 10, offset: 3, holdTillMatch: true }
);

if (!result) return console.log('matches not found');

const { entries, wereThereMatchesLeft } = result;

console.log('matches found:', entries);

console.log(
  wereThereMatchesLeft
    ? 'there are still more matches on db'
    : 'these are all matches in db',
);

// if holdTillMatch were false, wereThereMatchesLeft would be false too
```

- `findById`: Get the entry data identified by the `id` argument.

```js
const data = await db.findById('d98821f5-87a6-47c8-bb46-8af04a65c7ba');

if (!data) return console.log('entry not found');

console.log("entry's data:", data);
```

> [!NOTE]
> Same as add and addOne, findById uses find under the hood, so use it only in those cases where you want to find only one entry having its id.

...and other methods to manipulate easily the db.

> [!NOTE]
> Almost all methods require reading the database file during execution, so the time it takes to execute each method depends on the size of the database 😱. When possible, consider splitting databases that are intended to store large amounts of data to improve performance.

### 💥FlickerError

FlickerDB's instances methods might throw exceptions. These errors are instances of FlickerError. FlickerError objects have two important properties: `message` and `code`.

- `code`: error code assigned to each type of error. Example values: 'MISSING_FILE', 'SERIALIZATION_ERROR'.

### 🦉Final thoughts

This library is not intended to replace more scalable, secure and, in general, better solutions like MySQL, MongoDB, etc. It has limited capabilities and use cases. You can use it for small projects or as a complement to other options. Use it wisely within its intended scope for optimal results ✨

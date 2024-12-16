import { FlickerDB } from '../core/flicker.js';

type Post = { title: string; content: string };

// creates db folder in the root directory and populates it with posts.json
const postsDB = new FlickerDB<Post>('db/posts');

const posts: Post[] = [];

let counter = 0;
while (counter < 20) {
	posts.push({
		title: `post${++counter}`,
		content: 'content',
	});
}

postsDB
	.add(posts)
	.then(([id1]) => {
		console.log('posts added correctly!');

		postsDB
			.findById(id1)
			.then(data => console.log('post 1 title:', data!.title))
			.catch(err =>
				console.log(
					'something went wrong searching the first entry:',
					err.message,
				),
			);
	})
	.catch(err =>
		console.log('something went wrong adding posts. error code:', err.code),
	);

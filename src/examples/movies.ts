import { FlickerDB } from '../core/flicker.js';

type Movie = {
	title: string;
	genres: string[];
	duration: number;
	poster: string;
	year: number;
	isNewRelease: boolean;
};

const moviesDB = new FlickerDB<Movie>('db/movies', { overwrite: false });

const currentYear = new Date().getFullYear();

// update isNewRelease prop
moviesDB
	.update(({ data }) => {
		const { year, isNewRelease } = data;

		// change isNewRelease to false for old movies
		if (year < currentYear && isNewRelease) {
			return { ...data, isNewRelease: false };
		}

		// change isNewRelease to true for new movies
		if (year === currentYear && !isNewRelease) {
			return { ...data, isNewRelease: true };
		}
	})
	.then(updatedMovies => {
		if (!updatedMovies) return console.log('no movie was updated');

		console.log(`${updatedMovies} movies updated!`);
	})
	.catch(console.error);

// delete all movies where release year is less than 1970
moviesDB
	.remove(({ data: { year } }) => year < 1970)
	.then(removedMovies => {
		if (!removedMovies) {
			return console.log(
				'no movies where release year is less than 1970 were found',
			);
		}

		console.log(`${removedMovies} movies removed`);
	})
	.catch(() => console.log('could not remove movies'));

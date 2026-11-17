function assertPublicationReview(review, bases) {
  if (review.status !== 'approved' || !Array.isArray(review.unresolved) || review.unresolved.length) {
    throw new Error('Publication blocked: unresolved image risk review (.ci/publication-review.json)');
  }
  if (review.scope?.build !== bases.build || review.scope?.runtime !== bases.runtime) {
    throw new Error('Publication review does not match the pinned container bases');
  }
}
module.exports = { assertPublicationReview };

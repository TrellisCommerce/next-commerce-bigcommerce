import { productInfoFragment } from '../fragments/product';

export const getCollectionQuery = /* GraphQL */ `
  query getCollection($handle: String!) {
    collection(handle: $handle) {
      ...collection
    }
  }
`;

export const getCollectionsQuery = /* GraphQL */ `
  query getCollections {
    collections(first: 100, sortKey: TITLE) {
      edges {
        node {
          ...collection
        }
      }
    }
  }
`;

export const getCollectionProductsQuery = /* GraphQL */ `
  query getCollectionProducts(
    $hasLocale: Boolean = false
    $locale: String = "null"
    $first: Int = 100
    $categoryId: Int!
  ) {
    site {
      category(entityId: $categoryId) {
        products(first: $first) {
          pageInfo {
            startCursor
            endCursor
          }
          edges {
            cursor
            node {
              ...productInfo
            }
          }
        }
      }
    }
  }
  ${productInfoFragment}
`;

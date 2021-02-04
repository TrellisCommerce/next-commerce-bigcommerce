const getProductQuery = /* GraphQL */ `
  query getProductBySlug($slug: String!) {
    productByHandle(handle: $slug) {
      id
      handle
      title
      productType
      vendor
      description
      descriptionHtml
      options {
        id
        name
        values
      }
      priceRange {
        maxVariantPrice {
          amount
          currencyCode
        }
        minVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 250) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
        edges {
          node {
            id
            title
            selectedOptions {
              name
              value
            }
            price
            compareAtPrice
          }
        }
      }
      images(first: 250) {
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
        edges {
          node {
            src
          }
        }
      }
    }
  }
`

export default getProductQuery

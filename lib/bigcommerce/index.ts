import { HIDDEN_PRODUCT_TAG } from 'lib/constants';
import { isBigCommerceError } from 'lib/type-guards';
import {
  addToCartMutation,
  createCartMutation,
  editCartItemsMutation,
  removeFromCartMutation
} from './mutations/cart';
import { getCartQuery } from './queries/cart';
import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery
} from './queries/collection';
import { getSiteInfoQuery } from './queries/menu';
import { getPageQuery } from './queries/page';
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductsQuery
} from './queries/product';
import {
  Cart,
  Collection,
  Connection,
  Menu,
  Page,
  Product,
  ShopifyAddToCartOperation,
  ShopifyCart,
  ShopifyCartOperation,
  ShopifyCollection,
  ShopifyCollectionOperation,
  ShopifyCollectionProductsOperation,
  ShopifyCollectionsOperation,
  BigCommerceCreateCartOperation,
  ShopifyMenuOperation,
  ShopifyPageOperation,
  ShopifyPagesOperation,
  ShopifyProduct,
  ShopifyProductOperation,
  ShopifyProductRecommendationsOperation,
  ShopifyProductsOperation,
  ShopifyRemoveFromCartOperation,
  ShopifyUpdateCartOperation,
  BCCategory
} from './types';
import { Product } from './schema';

const domain = process.env.BIGCOMMERCE_STOREFRONT_DOMAIN!;
const graphQLEndpoint = process.env.BIGCOMMERCE_STOREFRONT_GRAPHQL_API_URL;
const restEndpoint = process.env.BIGCOMMERCE_STOREFRONT_REST_API_URL;
const key = process.env.BIGCOMMERCE_STOREFRONT_API_TOKEN!;

type ExtractVariables<T> = T extends { variables: object } ? T['variables'] : never;

enum HTTPMethod {
  CONNECT = 'CONNECT',
  DELETE = 'DELETE',
  GET = 'GET',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
  TRACE = 'TRACE'
}

export async function bigCommerceGraphQLFetch<T>({
  query,
  variables,
  headers,
  cache = 'force-cache'
}: {
  query: string;
  variables?: ExtractVariables<T>;
  headers?: HeadersInit;
  cache?: RequestCache;
}): Promise<{ status: number; body: T } | never> {
  try {
    const result = await fetch(graphQLEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJjaWQiOjEsImNvcnMiOlsiaHR0cHM6Ly9kZXZlbG9wZXIuYmlnY29tbWVyY2UuY29tIl0sImVhdCI6MTY4MzQ5OTE1NSwiaWF0IjoxNjgzMzI2MzU1LCJpc3MiOiJCQyIsInNpZCI6MTAwMjA0MDk0NSwic3ViIjoiYmNhcHAubGlua2VyZCIsInN1Yl90eXBlIjowLCJ0b2tlbl90eXBlIjoxfQ.PiIDNrGUPvomigiiCfy4Obt31x0ijMy_970Aa3T_QttlxH6mEbch8GfTh4976EqmhvJlPSyhzJdtD12YT5dsdQ',
        ...headers
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables })
      }),
      cache,
      next: { revalidate: 900 } // 15 minutes
    });

    const body = await result.json();

    if (body.errors) {
      throw body.errors[0];
    }

    return {
      status: result.status,
      body
    };
  } catch (e) {
    if (isBigCommerceError(e)) {
      throw {
        status: e.status || 500,
        message: e.message,
        query
      };
    }

    throw {
      error: e,
      query
    };
  }
}

export async function bigCommerceRestFetch<T>({
  path,
  method,
  body,
  headers,
  cache = 'force-cache'
}: {
  path: string;
  method: HTTPMethod;
  body?: object;
  headers?: HeadersInit;
  cache?: RequestCache;
}): Promise<{ status: number; body: T } | never> {
  try {
    const result = await fetch(`${restEndpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': '***REMOVED***',
        ...headers
      },
      body: body ? JSON.stringify(body) : null,
      cache,
      next: { revalidate: 900 } // 15 minutes
    });

    const returnedBody = await result.json();

    console.log('returnedBody:');
    console.dir(returnedBody);

    if (returnedBody.errors) {
      throw returnedBody.errors[0];
    }

    return {
      status: result.status,
      body: returnedBody
    };
  } catch (e) {
    if (isBigCommerceError(e)) {
      throw {
        status: e.status || 500,
        message: e.message,
        path
      };
    }

    throw {
      error: e,
      path
    };
  }
}

const removeEdgesAndNodes = (array: Connection<any>) => {
  return array.edges.map((edge) => edge?.node);
};

const reshapeCart = (cart: ShopifyCart): Cart => {
  if (!cart.cost?.totalTaxAmount) {
    cart.cost.totalTaxAmount = {
      amount: '0.0',
      currencyCode: 'USD'
    };
  }

  return {
    ...cart,
    lines: removeEdgesAndNodes(cart.lines)
  };
};

const reshapeCollection = (collection: ShopifyCollection): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.handle}`
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeProduct = (product: Product) => {
  if (!product) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  const featuredImage = removeEdgesAndNodes(images).filter((image) => image.isDefault === true);

  const priceRange = {
    minVariantPrice: {
      amount: product.prices?.priceRange?.min?.value,
      currencyCode: product.prices?.priceRange?.min?.currencyCode
    },
    maxVariantPrice: {
      amount: product.prices?.priceRange?.max?.value,
      currencyCode: product.prices?.priceRange?.max?.currencyCode
    }
  };

  return {
    ...rest,
    images: removeEdgesAndNodes(images),
    variants: removeEdgesAndNodes(variants),
    featuredImage: {
      url: featuredImage.urlOriginal
    },
    priceRange
  };
};

const reshapeProducts = (products: Product[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  // TODO: Shopify creates empty carts but BigCommerce doesn't. We need a product to create a cart. Figure this out later.
  const res = await bigCommerceRestFetch<BigCommerceCreateCartOperation>({
    method: HTTPMethod.POST,
    path: '/api/storefront/cart',
    cache: 'no-store'
  });

  console.log('cart', res);

  return reshapeCart(res.body.data.cartCreate.cart);
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const res = await bigCommerceGraphQLFetch<ShopifyAddToCartOperation>({
    query: addToCartMutation,
    variables: {
      cartId,
      lines
    },
    cache: 'no-store'
  });
  return reshapeCart(res.body.data.cartLinesAdd.cart);
}

export async function removeFromCart(cartId: string, lineIds: string[]): Promise<Cart> {
  const res = await bigCommerceGraphQLFetch<ShopifyRemoveFromCartOperation>({
    query: removeFromCartMutation,
    variables: {
      cartId,
      lineIds
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body.data.cartLinesRemove.cart);
}

export async function updateCart(
  cartId: string,
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const res = await bigCommerceGraphQLFetch<ShopifyUpdateCartOperation>({
    query: editCartItemsMutation,
    variables: {
      cartId,
      lines
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body.data.cartLinesUpdate.cart);
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const res = await bigCommerceGraphQLFetch<ShopifyCartOperation>({
    query: getCartQuery,
    variables: { cartId },
    cache: 'no-store'
  });

  if (!res.body.data.cart) {
    return null;
  }

  return reshapeCart(res.body.data.cart);
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  const res = await bigCommerceGraphQLFetch<ShopifyCollectionOperation>({
    query: getCollectionQuery,
    variables: {
      handle
    }
  });

  return reshapeCollection(res.body.data.collection);
}

export async function getCollectionProducts(
  categoryId: number,
  limit?: number
): Promise<Product[]> {
  const res = await bigCommerceGraphQLFetch<ShopifyCollectionProductsOperation>({
    query: getCollectionProductsQuery,
    variables: {
      categoryId,
      first: limit
    }
  });

  return reshapeProducts(removeEdgesAndNodes(res.body.data.site?.category?.products));
}

export async function getCollections(): Promise<Collection[]> {
  const res = await bigCommerceGraphQLFetch<ShopifyCollectionsOperation>({
    query: getCollectionsQuery
  });
  const shopifyCollections = removeEdgesAndNodes(res.body?.data?.collections);
  const collections = [
    {
      handle: '',
      title: 'All',
      description: 'All products',
      seo: {
        title: 'All',
        description: 'All products'
      },
      path: '/search',
      updatedAt: new Date().toISOString()
    },
    // Filter out the `hidden` collections.
    // Collections that start with `hidden-*` need to be hidden on the search page.
    ...reshapeCollections(shopifyCollections).filter(
      (collection) => !collection.handle.startsWith('hidden')
    )
  ];

  return collections;
}

export async function getMenu(): Promise<Menu[]> {
  const res = await bigCommerceGraphQLFetch<ShopifyMenuOperation>({
    // TODO: change return type
    query: getSiteInfoQuery
  });

  return (
    res.body?.data?.site?.categoryTree.map((category: BCCategory) => ({
      id: category.entityId,
      title: category.name,
      path: category.path
    })) || []
  );
}

export async function getPage(handle: string): Promise<Page> {
  const res = await bigCommerceGraphQLFetch<ShopifyPageOperation>({
    query: getPageQuery,
    variables: { handle }
  });

  return res.body.data.pageByHandle;
}

export async function getPages(): Promise<Page[]> {
  const res = await shopifyFetch<ShopifyPagesOperation>({
    query: getPagesQuery
  });

  return removeEdgesAndNodes(res.body.data.pages);
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const res = await bigCommerceGraphQLFetch<ShopifyProductOperation>({
    query: getProductQuery,
    variables: {
      handle
    }
  });

  return reshapeProduct(res.body.data.product, false);
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const res = await bigCommerceGraphQLFetch<ShopifyProductRecommendationsOperation>({
    query: getProductRecommendationsQuery,
    variables: {
      productId
    }
  });

  return reshapeProducts(res.body.data.productRecommendations);
}

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const res = await bigCommerceGraphQLFetch<ShopifyProductsOperation>({
    query: getProductsQuery,
    variables: {
      query,
      reverse,
      sortKey
    }
  });

  return reshapeProducts(removeEdgesAndNodes(res.body.data.products));
}

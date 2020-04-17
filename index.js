const num_requests = { variant0: 0, variant1: 0 }
let variants = undefined

/**
 * Handle requests by reponding with one of two variants in an A/B model with persistence.
 * @param {Request} req - The request to be handled.
 * @return {Promise<Response>} A promise to the selected variant's response.
 */
async function handleRequest(event) {
  const { request: req } = event
  if (req.method.toUpperCase() === "GET") {
    if (typeof variants === 'undefined') {
      const res = await fetch("https://cfw-takehome.developers.workers.dev/api/variants", {
        cf: {
          cacheTtl: 1800
        }
      })
      if (!res.ok)
        return new Response(`${res.statusText} status: ${res.status}`, { status: res.status });
      const result = await gatherResponse(res)
      variants = result.variants
    }

    let res
    const cookie = req.headers.get('cookie')
    if (cookie && cookie.includes("variant=0")) {
      num_requests.variant0++
      res = await fetch(variants[0])
    } else if (cookie && cookie.includes("variant=1")) {
      num_requests.variant1++
      res = await fetch(variants[1])
    } else {
      const variant = num_requests.variant0 <= num_requests.variant1 ? 0 : 1
      num_requests[`variant${variant}`]++
      // const variant = Math.random() < 0.5 ? 0 : 1
      res = await fetch(variants[variant])
      res = new Response(res.body, res)
      res.headers.append('Set-Cookie', `variant=${variant}; Max-Age=1209600; Secure; HttpOnly; SameSite=Lax`)
    }

    if (!res.ok)
      return new Response(`${res.statusText} status: ${res.status}`, { status: res.status });

    res = new Response(res.body, res)
    res.headers.set('Cache-Control', 'public, max-age=1800')

    return rewriter.transform(res)
  } else {
    return new Response("Expected GET", { status: 405 })
  }
}

/** An ElementHandler class to set the inner content of the HTML element. */
class InnerContentRewriter {
  /**
   * Create an ElementHandler to set the inner content of an HTML element.
   * @constructor
   * @param {string} innerContent - The attribute name.
   */
  constructor(innerContent) {
    this.innerContent = innerContent
  }

  /**
   * Called when an element is matched by the selector.
   * @param {Element} element - The matched element to be manipulated.
   */
  element(element) {
    element.setInnerContent(this.innerContent, { html: false })
  }
}

/** An ElementHandler class to change the value of an HTML element attribute. */
class AttributeRewriter {
  /**
   * Create an ElementHandler to change the attribute of an HTML element.
   * @constructor
   * @param {string} attributeName - The attribute name.
   * @param {string} attributeValue - The attribute value.
   */
  constructor(attributeName, attributeValue) {
    this.attributeName = attributeName
    this.attributeValue = attributeValue
  }


  /**
   * Called when an element is matched by the selector.
   * @param {Element} element - The matched element to be manipulated.
   */
  element(element) {
    if (element.getAttribute(this.attributeName)) {
      element.setAttribute(
        this.attributeName,
        this.attributeValue
      )
    }
  }
}

const rewriter = new HTMLRewriter()
  .on('title', new InnerContentRewriter("Cloudflare's 2020 Intern Role Take-Home Challenge"))
  .on('h1#title', new InnerContentRewriter("Cloudflare's 2020 Intern Role Take-Home Challenge"))
  .on('p#description', new InnerContentRewriter("This is a take-home challenge for Cloudflare's 2020 intern role done by Khaled Emara. A random experiment wouldn't evenly divide the requests, because of persistence. For instance, the same agent will request the same variant, again and again and again, stressing requests to this variant. Keeping track of the number of requests is the only way to make them even. The ideal solution for this would be to use Workers KV, but since it's an unlimited plan only option, I haven't been able to use it. The next best option is global variables. But it's not ideal, because wokers will be terminated if not used for a long time and different edge locations will decommission a new instance. For the purposes of load balancing this is actually idea. Because if the volume of requests is low then balancing shouldn't be an issue and different edge locations means a new server to offload of the main server."))
  .on('a#url', new InnerContentRewriter("Go to the repo's GitHub page."))
  .on('a#url', new AttributeRewriter("href", "https://github.com/KhaledEmaraDev/internship_cloudflare-fullstack-2020"))

/**
 * Determine the response data type and parse it.
 * @param {Request} req - The response to be parsed.
 * @return {Promise<JSON> | Promise<USVString>} A promise to the response's data.
 */
async function gatherResponse(response) {
  const { headers } = response
  const contentType = headers.get('Content-Type')
  if (contentType.includes('application/json')) {
    return await response.json()
  } else {
    return await response.text()
  }
}

addEventListener("fetch", (event) => {
  try {
    event.respondWith(handleRequest(event));
  } catch (e) {
    return event.respondWith(new Response('Error thrown ' + e.message))
  }
});


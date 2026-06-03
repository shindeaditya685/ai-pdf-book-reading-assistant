/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://pdfmindai.dpdns.org',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
    ],
  },
}

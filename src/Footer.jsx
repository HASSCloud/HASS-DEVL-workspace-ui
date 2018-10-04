import React from 'react';
import { Container, Row, Col } from 'reactstrap';

const footerLinks = [
  {
    href: '//hasscloud.net.au/?page_id=42',
    label: 'About Us',
  },
  {
    href: '//hasscloud.net.au/?page_id=39',
    label: 'Contact Us',
  },
  {
    href: '//hasscloud.net.au/?page_id=452',
    label: 'Data Framework',
  },
  {
    href: '//hasscloud.net.au/?page_id=584',
    label: 'Guides, Case Studies & Recipes',
  },
  {
    href: '//hasscloud.net.au/?page_id=74',
    label: 'Project Blog',
  },
];

export default class Footer extends React.Component {
  render() {
    const footerMain = (
      <footer id="footer">
        <Container>
          <Row>
            <Col md="12">
              <ul>
                {
                  footerLinks.map(link => (
                    <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer" title={link.label}>{link.label}</a></li>
                  ))
                }
              </ul>
            </Col>
          </Row>
        </Container>
      </footer>
    );

    return footerMain;
  }
}

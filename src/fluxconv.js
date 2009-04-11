/*
  fluxconv.cgi ver.2.0 June 22, 2001
  astronomical flux unit converter available from
    http://zunda.freeshell.org/scripts/src/fluxconv.html
  Copyright (C) 2001 zunda <zunda at freeshell.org>

	$Id: fluxconv.html,v 1.2 2003/04/04 16:52:43 zunda Exp $

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program; if not, write to the Free Software
   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307  USA

 Change log:
 ver.1.1 Dec  9, 2000 zunda <zunda at freeshell.org>
 ver.1.2 Mar  8, 2001 zunda <zunda at freeshell.org>
   check for division by zero error
 ver.1.3 Mar 24, 2001 zunda <zunda at freeshell.org>
   offline mode
 ver 1.4 Mar 29, 2001 zunda <zunda at freeshell.org>
   check minus flux before calculating magnitude
 ver 1.5 Apr 18, 2001 zunda <zunda at freeshell.org>
   check query value not to run cross-site scripting
 ver 2.0 Jun 22, 2001 zunda <zunda at freeshell.org>
   Javascript version
*/

// Possible units
function Unit(name, html, neg, log) {
  this.name = name;			// Unit name in plain text
  this.html = html;			// Unit name in HTML
  this.neg = neg;			// Allow negative value?
  this.logdisp = log;			// Logarithmic unit?
}
units = new Array(
  new Unit('Jy', 	'Jy', 				false, true),
  new Unit('Wm2um', 	'W/m<sup>2</sup>/um',		false, true),
  new Unit('Wcm2um', 	'W/cm<sup>2</sup>/um',		false, true),
  new Unit('ergseccm2um','erg/sec/cm<sup>2</sup>/um',	false, true),
  new Unit('psseccm2um','photons/sec/cm<sup>2</sup>/um',false, true),
  new Unit('Wm2', 	'W/m<sup>2</sup>',		false, true),
  new Unit('Wcm2', 	'W/cm<sup>2</sup>',		false, true),
  new Unit('ergseccm2',	'erg/sec/cm<sup>2</sup>',	false, true),
  new Unit('psseccm2',	'photons/sec/cm<sup>2</sup>',	false, true),
  new Unit('mag', 	'mag',				true, false),
  new Unit('ABmag', 	'ABmag',			true, false)
);
// get the index for units[] of Jy
for(i = 0; i < units.length; i++) {
  if (units[i].name == 'Jy') {
    indexJy = i;
    break;
  }
}
prec = 4;				// number of digits
logarithmic = 4;			// minimum log(x) to use E+nn
base = 10;				// base to be displayed

function RoundStr(x, islog) {
  var v, s, p, o; 	// v = s * p * 10^o
  var pp, po;		// p = pp * 10^po
  var i, j, k, l;	// temp
  var rstr, tstr;	// return string
  var isdot;		// period?
  var n;		// number of digits displayed
  var dpos, prezero, postzero;
    // period position (after this number of digits not including zero)
    // number of zero's between period and first digits
    // number of zero's after digits
  var tzero;		// zero threshold
  tzero = Math.pow(10,-prec-1);

  // sign
  v = x; if (v < 0) {s = -1; v = -v;} else {s = 1;}

  // order
  if (islog && v > 0) {
    o = Math.floor(Math.log(v)/Math.log(10));
  } else {
    o = 0;
  }
  k = Math.pow(10,o);
  p = v/k;

  if (p > tzero) {
    // make the digits
    po = Math.floor(Math.log(p)/Math.log(10)+Math.pow(10,-1-prec));
    k = Math.pow(10,po+1-prec);
    pp = p/k;
    rstr = String(Math.round(pp));
    // add period
    if (0 <= po && po < prec-1) {
      tstr = rstr.substring(0,po+1)+'.'+rstr.substring(po+1,prec);
      rstr = tstr;
    }
    // prefix zeros
    if (po < 0) {
      tstr = rstr;
      rstr = '0.';
      for(i = 1; i < -po; i++) {
        rstr += '0';
      }
      rstr += tstr;
    }
    // postfix zeros
    if (po >= prec) {
      for(i = 0; i <= po - prec; i++) {
        rstr += '0';
      }
    }
    // add order part
    if (o != 0) {
      rstr += 'e';
      if (o>0) {rstr += '+';}
      rstr += String(o);
    }
    // prefix sign
    if (s < 0) {
      tstr = '-' + rstr;
      rstr = tstr;
    }
  } else {
    rstr = '0';
    if (prec > 2) {
      rstr += '.';
      for(i = 0; i < prec-1; i++) {
        rstr += '0';
      }
    }
  }

  return rstr;
}

// AB magnitude
// AB=-2.5log fv[erg/sec/cm2/Hz] - 48.60

// Possible bands and zero points:
// photometric zero point and bands
// J,H,K,L',M,N,N1,N2,N3,Q from
//   http://www.iso.vilspa.esa.es/manuals/iso_idum4/node31.html
// U,B,V,R,I calculated from
//   'Astronomical Photometry, a guide,' Sterken, CHR. and Manfroid, J.,
//   Kluwer Academic Publishers, 1992
function Band(name, Wm2um, center, width) {
  this.name = name;			// Name
  this.Wm2um = Wm2um;			// Zero mag in W/m2/um
  this.center = center;			// Central wavelength in um
  this.width = width;			// Fullwidth in um
}
bands = new Array(
  new Band('U',  4.220E-08,  0.365, 0.070),
  new Band('B',  6.400E-08,  0.440, 0.100),
  new Band('V',  3.750E-08,  0.550, 0.090),
  new Band('R',  1.700E-08,  0.720, 0.220),
  new Band('I',  8.300E-09,  0.900, 0.240),
  new Band('J',  3.096E-09,  1.240, 0.200),
  new Band('H',  1.198E-09,  1.640, 0.300),
  new Band('K',  4.122E-10,  2.180, 0.400),
  new Band('L', 5.369E-11,  3.760, 0.700),
  new Band('M',  2.046E-11,  4.690, 0.500),
  new Band('N',  8.314E-13, 10.300, 5.200),
  new Band('N1', 2.080E-12,  8.380, 0.800),
  new Band('N2', 1.120E-12,  9.670, 1.600),
  new Band('N3', 3.551E-13, 12.900, 3.700),
  new Band('Q',  8.238E-14, 18.600, 5.600)
);

// status of the script
lastunit = -1;				// last unit where value updated
curstat=0;				// wait
strstat = new Array(
  'Input wavelegnth and flux',		// 0
  'Calculating'				// 1
);

// input wavlength for the band and calculate
function selband(that) {
  var sel;
  // get the selected index for bands[]
  sel = that.values.band[that.values.band.selectedIndex].value;
  if (sel < bands.length) {		// if it is a valid band:
    // write the wavelength
    that.values.l.value = bands[sel].center;
    that.values.dl.value = bands[sel].width;
    // calculate conversion
    update(that, -1);
  }
  // to match the wavelength displayed and band displayed
  updateband(that);
}

// match the band name according to the wavelength inputed
function updateband(that) {
  var t, i;
  t = false;				// see if there is a match
  for(i = 0; i < that.values.band.length; i++) {	// scan options
    b=that.values.band[i].value;			// index for bands[]
    if (b < bands.length && that.values.l.value == bands[b].center) {
      t=true;						// if it matches
      that.values.band[i].selected = true;
    } else {
      that.values.band[i].selected = false;
    }
  }
  if (!t) {
    that.values.band[0].selected = true;		// if not
  }
}

// calculate and update
function update(that, newunit) {
  var r, l, dl, newvalue, newflux;
  // change status
  curstat=1;
  dispStat(that);
  // wavelength changed
  if (newunit == -2) {
    updateband(that);
  }
  // Check wavelength
  l = that.values.l.value;
  if (!(l > 0)) {
    alert('Input possitive value for wavelength.');
    if (l <= 0) {
      l *= -1;
      that.values.l.value = l;
    } else {
      that.values.l.value = 1;
      return -1;
    }
  }
  dl = that.values.dl.value;
  if (!(dl > 0)) {
    that.values.dl.value = '';
    dl = -1;
  }
  // remember last unit used
  if (newunit < 0) {newunit = lastunit;}
  if (newunit < 0) {
    alert('Please input flux');
    return(-1);
  }
  // get the value
  newvalue = that.values[units[newunit].name].value;
  if (!(newvalue > 0)) {			// if it is not positive value
    if (!units[newunit].neg) {			// if it can't be negative
      alert('Input possitive value for flux.');
      if (newvalue <= 0) {			// if it is negative
        newvalue *= -1;				// change sign
        that.values[units[newunit].name].value = newvalue;
      } else {					// if it is not a value
        that.values[units[newunit].name].value = '';
        return -1;
      }
    } else {
      if (!(newvalue <= 0)) {			// if it is not a value
        alert('Input a value for flux.');
        that.values[units[newunit].name].value = '';
        return -1;
      }
    }
  }
  // calculate flux in W/m2/um or W/m2
  newflux = Flux_getFlux(newvalue, newunit, l, dl);

  // calculate flux in other units
  if (newflux.density != '' || newflux.integ != '') {
    for(i = 0; i < units.length; i++) {
      r = Flux_putFlux(newflux, i, l, dl);
      if (r * r > 0 || r == 0) {
        that.values[units[i].name].value = RoundStr(r, units[i].logdisp);
      } else {
        that.values[units[i].name].value = '';
      }
    }
  }
  lastunit = newunit;

  curstat = 0;
  dispStat();
  return 0;
};

// Convert flux from value with the unit number at center(um) and width(um)
// into W/m2 and W/m2/um
function Flux_getFlux(newvalue, newunit, center, width) {
  var t, Jy;
  this.density = '';
  this.integ = '';

  switch(units[newunit].name) {
  case 'Jy':
    if (center > 0) {this.density = 3e-12*newvalue/(center*center);}
    break;
  case 'Wm2um':
    this.density = newvalue;
    break;
  case 'Wcm2um':
    this.density = newvalue/1e-4;
    break;
  case 'ergseccm2um':
    this.density = newvalue*1e-7/1e-4;
    break;
  case 'psseccm2um':
    if (center > 0) {this.density = newvalue*hnu(center)*1e4;}
    break;
  case 'Wm2':
    this.integ = newvalue;
    break;
  case 'Wcm2':
    this.integ = newvalue/1e-4;
    break;
  case 'ergseccm2':
    this.integ = newvalue*1e-7/1e-4;
    break;
  case 'psseccm2':
    if (center > 0) {this.integ = newvalue*hnu(center)*1e4;}
    break;
  case 'mag':
    t = ZeroWm2um(center);
    if (t < 0) {
      alert('Please select a band from the selections.');
    } else {
      if (((newvalue>0) ? newvalue : -newvalue) > 100) {
        alert('Magnitude too big.');
      }
      this.density =  Math.pow(10,-newvalue/2.5) * t;
    }
    break;
  case 'ABmag':
    if (((newvalue>0) ? newvalue : -newvalue) > 100) {
      alert('Magnitude too big.');
    }
    Jy = Math.pow(10,(8.9-newvalue)/2.5);
    this.Flux_getFlux(Jy, indexJy, center, width);
    // AB=-2.5log fv[erg/sec/cm2/Hz] - 48.60
    //   =-2.5log fv[Jy] +8.9
    break;
  }
  if (this.integ > 0 && width > 0 && !(this.density > 0)) {
    this.density = this.integ/width;
  }
  if (this.density > 0 && width > 0 && !(this.integ > 0)) {
    this.integ = this.density*width;
  }
  return this;
}

function Flux_putFlux(value, unit, center, width) {
  var r, t, Jy;
  r = NaN;

  switch(units[unit].name) {
  case 'Jy':
    if (value.density > 0 && center > 0) {
      r = value.density/3e-12*(center*center);
    }
    break;
  case 'Wm2um':
    if (value.density > 0) {r = value.density;}
    break;
  case 'Wcm2um':
    if (value.density > 0) {r = value.density*1e-4;}
    break;
  case 'ergseccm2um':
    if (value.density > 0) {r = value.density/1e-7*1e-4;}
    break;
  case 'psseccm2um':
    if (value.density > 0 && center > 0) {
      r = value.density/hnu(center)/1e4;
    }
    break;
  case 'Wm2':
    if (value.integ > 0) {r = value.integ;}
    break;
  case 'Wcm2':
    if (value.integ > 0) {r = value.integ*1e-4;}
    break;
  case 'ergseccm2':
    if (value.integ > 0) {r = value.integ/1e-7*1e-4;}
    break;
  case 'psseccm2':
    if (value.integ > 0 && center > 0) {
      r = value.integ/hnu(center)/1e4;
    }
    break;
  case 'mag':
    if (value.density > 0) {
      t = ZeroWm2um(center);
      if (t > 0) {r = -2.5*Math.log(value.density/t)/Math.log(10);}
    }
    break;
  case 'ABmag':
    Jy = Flux_putFlux(value, indexJy, center, width);
    if (Jy > 0) {r = -2.5*Math.log(Jy)/Math.log(10)+8.9;}
    break;
  }

  return r;
}

// Energy of a photon in J
function hnu(l) {
  var r;
  if (l > 0) {
    r = 6.626e-34*3e-8/(l*1e-6);
  } else {
    r = '';
  }
  return r;
}

// Flux
function Flux() {
  this.density = '';			// flux in W/m2/um
  this.integ = '';			// flux in W/m2

  this.getFlux = Flux_getFlux;
  this.putFlux = Flux_putFlux;
}

// Get magnitude zero point
function ZeroWm2um(l) {
  var r, i;
  r = -1;
  for(i = 0; i < bands.length; i++) {
    if (l == bands[i].center) {
      r = bands[i].Wm2um;
    }
  }
  return r;
}

// display current status
function dispStat() {
  status = strstat[curstat];
};
defaultStatus = strstat[curstat];	// status